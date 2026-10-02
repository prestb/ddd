// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
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
      return json({ error: 'Donation amount must be a whole number between 100 and 10,000,000 XAF.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await authClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const externalId = `donation-${crypto.randomUUID()}`;
    const redirectUrl = Deno.env.get('DONATION_REDIRECT_URL') ?? 'devotionalapp://donate/result';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/initiate-pay`, {
      method: 'POST',
      headers: { apiuser: apiUser, apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        ...(typeof body?.email === 'string' && body.email.includes('@') ? { email: body.email.trim() } : {}),
        ...(userId ? { userId } : {}),
        externalId,
        redirectUrl,
        message: 'Daily Dew Devotional ministry support',
      }),
    });
    const rawResponse = await response.text();
    let result: any = {};
    try { result = rawResponse ? JSON.parse(rawResponse) : {}; } catch { result = { message: rawResponse }; }
    if (!response.ok || !result?.transId || !result?.link) {
      const providerMessage = result?.message || rawResponse || 'No response body was returned by Fapshi.';
      console.error(`Fapshi direct-pay rejected the request: HTTP ${response.status} - ${providerMessage}`);
      throw new Error(`Fapshi HTTP ${response.status}: ${providerMessage}`);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertError } = await admin.from('donations').insert({
      user_id: userId,
      external_id: externalId,
      transaction_id: result.transId,
      amount,
    });
    if (insertError) {
      console.error('Could not record donation', insertError);
      throw new Error('Payment started, but the transaction could not be recorded. Check the donations migration.');
    }

    return json({ link: result.link, transId: result.transId, externalId });
  } catch (error) {
    console.error('create-donation failed', error);
    return json({ error: error instanceof Error ? error.message : 'Donation could not be started.' }, 400);
  }
});
