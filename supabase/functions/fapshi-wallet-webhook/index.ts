// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-wh-secret',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const secret = Deno.env.get('FAPSHI_WEBHOOK_SECRET');
    if (secret && request.headers.get('x-wh-secret') !== secret) {
      return new Response('Unauthorized', { status: 401, headers: cors });
    }

    const payload = await request.json();
    const transId = payload?.transId;
    const providerStatus = payload?.status;
    const providerAmount = Number(payload?.amount) || null;

    if (!transId || !providerStatus) {
      return new Response(JSON.stringify({ received: true, note: 'Missing transaction details' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (providerStatus === 'SUCCESSFUL' || providerStatus === 'SUCCESS') {
      // ATOMIC TRANSACTION: Call process_verified_wallet_deposit RPC.
      // Performs SELECT ... FOR UPDATE on payment_transactions row,
      // checks idempotency, locks wallet, inserts ledger row, updates balance,
      // and marks payment successful in ONE atomic PostgreSQL transaction.
      const { data: processResult, error: rpcError } = await admin.rpc('process_verified_wallet_deposit', {
        p_provider_transaction_id: transId,
        p_provider_amount: providerAmount,
        p_webhook_metadata: { provider: 'fapshi', payload },
      });

      if (rpcError) {
        console.error('fapshi-wallet-webhook: process_verified_wallet_deposit RPC failed', rpcError);
        throw rpcError;
      }

      console.info('fapshi-wallet-webhook result:', processResult);
      return new Response(JSON.stringify({ received: true, ...processResult }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } else if (providerStatus === 'FAILED' || providerStatus === 'EXPIRED' || providerStatus === 'CANCELLED') {
      const nextStatus = providerStatus === 'EXPIRED' || providerStatus === 'CANCELLED' ? 'cancelled' : 'failed';

      // Update payment_transactions row status
      await admin
        .from('payment_transactions')
        .update({
          status: nextStatus,
          metadata: { providerStatus, payload },
          updated_at: new Date().toISOString(),
        })
        .eq('provider_transaction_id', transId);

      return new Response(JSON.stringify({ received: true, status: nextStatus }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ received: true, status: 'pending' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('fapshi-wallet-webhook failed', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
