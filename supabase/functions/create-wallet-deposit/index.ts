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
    const baseUrl = Deno.env.get('FAPSHI_BASE_URL') ?? 'https://sandbox.fapshi.com';
    if (!apiKey || !apiUser) throw new Error('Fapshi is not configured on the server.');

    const body = await request.json();
    const amount = Number(body?.amount);
    if (!Number.isInteger(amount) || amount < 100 || amount > 10000000) {
      return json({ error: 'Funding amount must be a whole number between 100 and 10,000,000 XAF.' }, 400);
    }

    const provider = body?.provider === 'orange' ? 'orange' : 'mtn';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return json({ error: 'Authentication required to fund account balance.' }, 401);
    }

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Invalid or expired user session.' }, 401);
    }

    const externalReference = `deposit-${crypto.randomUUID()}`;
    const redirectUrl = Deno.env.get('WALLET_REDIRECT_URL') ?? 'devotionalapp://membership';

    // 1. Record pending payment_transactions row before provider request
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: pendingTx, error: insertError } = await admin
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        purpose: 'wallet_deposit',
        provider: 'fapshi',
        external_reference: externalReference,
        amount,
        currency: 'XAF',
        status: 'pending',
        metadata: {
          phone,
          provider_method: provider,
          email: user.email,
        },
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Could not create pending payment_transactions row', insertError);
      throw new Error('Could not record payment transaction.');
    }

    // 2. Initiate Fapshi Mobile Money request
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/initiate-pay`, {
      method: 'POST',
      headers: { apiuser: apiUser, apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        ...(user.email ? { email: user.email } : {}),
        userId: user.id,
        externalId: externalReference,
        redirectUrl,
        message: 'Daily Dew Account Balance Deposit',
      }),
    });

    const rawResponse = await response.text();
    let result: any = {};
    try { result = rawResponse ? JSON.parse(rawResponse) : {}; } catch { result = { message: rawResponse }; }

    if (!response.ok || !result?.transId) {
      const providerMessage = result?.message || rawResponse || 'No response body was returned by Fapshi.';
      console.error(`Fapshi deposit initiation failed: HTTP ${response.status} - ${providerMessage}`);

      await admin
        .from('payment_transactions')
        .update({ status: 'failed', metadata: { error: providerMessage } })
        .eq('id', pendingTx.id);

      throw new Error(`Fapshi HTTP ${response.status}: ${providerMessage}`);
    }

    // 3. Update payment_transactions row with provider_transaction_id
    await admin
      .from('payment_transactions')
      .update({
        provider_transaction_id: result.transId,
        metadata: {
          phone,
          provider_method: provider,
          email: user.email,
          fapshi_link: result.link,
        },
      })
      .eq('id', pendingTx.id);

    return json({
      link: result.link,
      transId: result.transId,
      externalReference,
      amount,
    });
  } catch (error) {
    console.error('create-wallet-deposit failed', error);
    return json({ error: error instanceof Error ? error.message : 'Wallet deposit could not be initiated.' }, 400);
  }
});
