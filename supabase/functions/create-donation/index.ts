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

function normalizeCameroonPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('6')) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('2376')) {
    return digits.slice(3);
  }
  if (digits.length === 10 && digits.startsWith('06')) {
    return digits.slice(1);
  }
  return digits;
}

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

    const rawPhone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const normalizedPhone = normalizeCameroonPhone(rawPhone);
    if (normalizedPhone.length !== 9 || !normalizedPhone.startsWith('6')) {
      return json({ error: 'Enter a valid 9-digit Cameroon Mobile Money phone number starting with 6 (e.g., 670000000).' }, 400);
    }

    const rawProvider = body?.provider;
    if (rawProvider !== 'mtn' && rawProvider !== 'orange') {
      return json({ error: 'INVALID_PROVIDER', message: 'Select MTN Mobile Money or Orange Money.' }, 400);
    }
    const medium = rawProvider === 'orange' ? 'orange money' : 'mobile money';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await authClient.auth.getUser();
      userId = user?.id ?? null;
      userEmail = user?.email ?? null;
    }

    if (!userEmail && typeof body?.email === 'string' && body.email.includes('@')) {
      userEmail = body.email.trim();
    }

    const externalId = `donation-${crypto.randomUUID()}`;
    const verificationToken = crypto.randomUUID();
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Record pending donation row FIRST before provider Direct Pay request
    const { data: pendingDonation, error: insertError } = await admin
      .from('donations')
      .insert({
        user_id: userId,
        external_id: externalId,
        amount,
        status: 'pending',
        metadata: {
          verification_token: verificationToken,
          phone: normalizedPhone,
          provider_method: rawProvider,
          email: userEmail,
        },
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Could not create pending donation row', insertError);
      throw new Error('Could not record donation transaction.');
    }

    // 2. Initiate Fapshi Direct Pay request
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/direct-pay`, {
      method: 'POST',
      headers: { apiuser: apiUser, apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        phone: normalizedPhone,
        medium,
        ...(userEmail ? { email: userEmail } : {}),
        ...(userId ? { userId } : {}),
        externalId,
        message: 'Daily Dew Devotional ministry support',
      }),
    });

    const rawResponse = await response.text();
    let result: any = {};
    try { result = rawResponse ? JSON.parse(rawResponse) : {}; } catch { result = { message: rawResponse }; }

    if (!response.ok || !result?.transId) {
      const providerMessage = result?.message || rawResponse || 'No response body was returned by Fapshi.';
      console.error(`Fapshi Direct Pay donation failed: HTTP ${response.status} - ${providerMessage}`);

      await admin
        .from('donations')
        .update({ status: 'failed', metadata: { error: providerMessage, verification_token: verificationToken } })
        .eq('id', pendingDonation.id);

      throw new Error(`Fapshi HTTP ${response.status}: ${providerMessage}`);
    }

    // 3. Update donation row with provider transaction_id
    await admin
      .from('donations')
      .update({
        transaction_id: result.transId,
        metadata: {
          verification_token: verificationToken,
          phone: normalizedPhone,
          provider_method: rawProvider,
          email: userEmail,
          direct_pay_response: result,
        },
      })
      .eq('id', pendingDonation.id);

    return json({
      success: true,
      transId: result.transId,
      externalId,
      verificationToken,
      amount,
      phone: normalizedPhone,
    });
  } catch (error) {
    console.error('create-donation failed', error);
    return json({ error: error instanceof Error ? error.message : 'Donation could not be started.' }, 400);
  }
});
