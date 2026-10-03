// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Only POST is supported.' }, 405);

  try {
    const apiKey = Deno.env.get('FAPSHI_API_KEY');
    const apiUser = Deno.env.get('FAPSHI_API_USER');
    const baseUrl = Deno.env.get('FAPSHI_BASE_URL') ?? 'https://live.fapshi.com';
    if (!apiKey || !apiUser) {
      console.error('check-wallet-deposit-status: Fapshi credentials missing in environment.');
      return json({ error: 'SERVER_CONFIGURATION_ERROR', message: 'Server configuration error.' }, 500);
    }

    const body = await request.json();
    const transId = typeof body?.transId === 'string' ? body.transId.trim() : '';

    if (!transId) {
      return json({ error: 'MISSING_TRANS_ID', message: 'Transaction ID is required to verify status.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return json({ error: 'UNAUTHORIZED', message: 'Authentication required to check deposit status.' }, 401);
    }

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return json({ error: 'UNAUTHORIZED', message: 'Invalid or expired user session.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Locate payment_transactions row for this user and transId
    const { data: paymentTx, error: selectError } = await admin
      .from('payment_transactions')
      .select('id, user_id, amount, status, purpose, provider_transaction_id, external_reference')
      .or(`provider_transaction_id.eq.${transId},external_reference.eq.${transId}`)
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('WALLET_STATUS_LOOKUP', {
      hasTransId: Boolean(transId),
      transactionFound: Boolean(paymentTx),
      purpose: paymentTx?.purpose ?? null,
      internalStatus: paymentTx?.status ?? null,
      hasProviderTransactionId: Boolean(paymentTx?.provider_transaction_id),
    });

    if (selectError) {
      console.error('check-wallet-deposit-status: Database query error', selectError);
      return json({ error: 'DATABASE_ERROR', message: 'Database query failed.' }, 500);
    }

    if (!paymentTx) {
      return json({ error: 'PAYMENT_NOT_FOUND', message: 'The payment transaction could not be found for this user.' }, 404);
    }

    if (paymentTx.purpose !== 'wallet_deposit') {
      return json({ error: 'INVALID_PURPOSE', message: 'Transaction purpose mismatch.' }, 400);
    }

    // If transaction is already marked successful internally, return success immediately
    if (paymentTx.status === 'successful') {
      return json({
        status: 'successful',
        amount: paymentTx.amount,
        transId: paymentTx.provider_transaction_id ?? transId,
      });
    }

    const targetTransId = paymentTx.provider_transaction_id ?? transId;

    console.log('FAPSHI_STATUS_REQUEST', {
      environment: 'live',
      baseUrl: baseUrl.replace(/\/$/, ''),
      transId: targetTransId,
    });

    // 2. Query authoritative Fapshi status API
    const fapshiRes = await fetch(`${baseUrl.replace(/\/$/, '')}/payment-status/${targetTransId}`, {
      method: 'GET',
      headers: { apiuser: apiUser, apikey: apiKey, 'Content-Type': 'application/json' },
    });

    if (!fapshiRes.ok) {
      const rawErrorText = await fapshiRes.text();
      console.error(`check-wallet-deposit-status: Fapshi API returned HTTP ${fapshiRes.status} - ${rawErrorText}`);
      return json({ error: 'PAYMENT_PROVIDER_STATUS_FAILED', message: 'Payment provider status check failed.' }, 502);
    }

    const rawText = await fapshiRes.text();
    let fapshiData: any = {};
    try { fapshiData = rawText ? JSON.parse(rawText) : {}; } catch { fapshiData = { message: rawText }; }

    console.log('FAPSHI_STATUS_RESPONSE', {
      httpStatus: fapshiRes.status,
      transId: fapshiData?.transId ?? targetTransId,
      providerStatus: fapshiData?.status ?? fapshiData?.paymentStatus ?? null,
      providerAmount: fapshiData?.amount ?? null,
      providerMessage: fapshiData?.message ?? null,
    });

    const providerStatus = fapshiData?.status ?? fapshiData?.paymentStatus;

    if (providerStatus === 'SUCCESSFUL' || providerStatus === 'SUCCESS') {
      const rawAmount = fapshiData?.amount;
      const providerAmount = typeof rawAmount === 'number'
        ? rawAmount
        : typeof rawAmount === 'string' && /^\d+$/.test(rawAmount.trim())
        ? parseInt(rawAmount.trim(), 10)
        : null;

      if (providerAmount === null || !Number.isInteger(providerAmount) || providerAmount <= 0) {
        console.error(`check-wallet-deposit-status: Provider returned SUCCESSFUL but missing/invalid amount: ${rawAmount}`);
        return json({
          error: 'PROVIDER_AMOUNT_MISSING',
          message: 'Payment provider did not return a valid payment amount for verification.',
        }, 400);
      }

      if (providerAmount !== paymentTx.amount) {
        console.error(`check-wallet-deposit-status: Amount mismatch - Provider: ${providerAmount}, Ledger: ${paymentTx.amount}`);
        return json({
          error: 'AMOUNT_MISMATCH',
          message: 'Provider transaction amount does not match the expected deposit amount.',
        }, 400);
      }

      console.log('WALLET_FULFILLMENT_RPC_REQUEST', {
        providerTransactionId: targetTransId,
        providerAmount,
        expectedAmount: paymentTx.amount,
      });

      // Execute atomic process_verified_wallet_deposit RPC
      const { data: processResult, error: rpcError } = await admin.rpc('process_verified_wallet_deposit', {
        p_provider_transaction_id: targetTransId,
        p_provider_amount: providerAmount,
        p_webhook_metadata: { source: 'check-wallet-deposit-status', fapshiData },
      });

      if (rpcError) {
        console.error('WALLET_FULFILLMENT_RPC_ERROR', {
          code: rpcError?.code ?? null,
          message: rpcError?.message ?? null,
          details: rpcError?.details ?? null,
          hint: rpcError?.hint ?? null,
        });
        return json({ error: 'PAYMENT_FULFILLMENT_FAILED', message: 'Wallet deposit fulfillment failed.' }, 500);
      }

      if (processResult?.status === 'not_found') {
        return json({ error: 'PAYMENT_NOT_FOUND', message: 'Provider transaction not found in internal ledger.' }, 404);
      }

      if (processResult?.status === 'amount_mismatch') {
        return json({ error: 'AMOUNT_MISMATCH', message: 'Provider transaction amount mismatch.' }, 400);
      }

      return json({
        status: 'successful',
        amount: paymentTx.amount,
        transId: targetTransId,
        result: processResult,
      });
    } else if (providerStatus === 'FAILED' || providerStatus === 'EXPIRED' || providerStatus === 'CANCELLED') {
      const nextStatus = providerStatus === 'EXPIRED' || providerStatus === 'CANCELLED' ? 'cancelled' : 'failed';
      await admin
        .from('payment_transactions')
        .update({
          status: nextStatus,
          metadata: { providerStatus, fapshiData },
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentTx.id);

      return json({
        status: nextStatus,
        amount: paymentTx.amount,
        transId: targetTransId,
      });
    }

    return json({
      status: 'pending',
      amount: paymentTx.amount,
      transId: targetTransId,
    });
  } catch (error) {
    console.error('check-wallet-deposit-status unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Status check failed.' }, 500);
  }
});
