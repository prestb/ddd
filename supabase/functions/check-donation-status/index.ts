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
    if (!apiKey || !apiUser) throw new Error('Fapshi is not configured on the server.');

    const body = await request.json();
    const transId = typeof body?.transId === 'string' ? body.transId.trim() : '';
    const verificationToken = typeof body?.verificationToken === 'string' ? body.verificationToken.trim() : null;

    if (!transId) {
      return json({ error: 'MISSING_TRANS_ID', message: 'Transaction ID is required to verify status.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = request.headers.get('Authorization');

    let userId: string | null = null;
    if (authHeader) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      userId = user?.id ?? null;
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Locate donation row with strict ownership / token verification
    let donationQuery = admin
      .from('donations')
      .select('id, user_id, amount, status, transaction_id, external_id, metadata')
      .or(`transaction_id.eq.${transId},external_id.eq.${transId}`);

    if (userId) {
      // Authenticated user: Scope query to authenticated user ID
      donationQuery = donationQuery.eq('user_id', userId);
    } else {
      // Anonymous user: Require non-guessable verification token
      if (!verificationToken) {
        return json({ error: 'UNAUTHORIZED', message: 'Verification token required for anonymous donation status check.' }, 401);
      }
      donationQuery = donationQuery.eq('metadata->>verification_token', verificationToken);
    }

    const { data: donation, error: selectError } = await donationQuery.maybeSingle();

    if (selectError) {
      console.error('check-donation-status: Database query error', selectError);
      return json({ error: 'DATABASE_ERROR', message: 'Database query failed.' }, 500);
    }

    if (!donation) {
      return json({ error: 'DONATION_NOT_FOUND', message: 'The donation transaction could not be found or authorization failed.' }, 404);
    }

    if (donation.status === 'successful') {
      return json({
        status: 'successful',
        amount: donation.amount,
        transId: donation.transaction_id ?? transId,
      });
    }

    const targetTransId = donation.transaction_id ?? transId;

    // 2. Query Fapshi status API
    const fapshiRes = await fetch(`${baseUrl.replace(/\/$/, '')}/payment-status/${targetTransId}`, {
      method: 'GET',
      headers: { apiuser: apiUser, apikey: apiKey, 'Content-Type': 'application/json' },
    });

    if (!fapshiRes.ok) {
      const rawErr = await fapshiRes.text();
      console.error(`check-donation-status: Fapshi status HTTP ${fapshiRes.status} - ${rawErr}`);
      return json({ error: 'PAYMENT_PROVIDER_STATUS_FAILED', message: 'Payment provider status check failed.' }, 502);
    }

    const rawText = await fapshiRes.text();
    let fapshiData: any = {};
    try { fapshiData = rawText ? JSON.parse(rawText) : {}; } catch { fapshiData = { message: rawText }; }

    const providerStatus = fapshiData?.status ?? fapshiData?.paymentStatus;

    if (providerStatus === 'SUCCESSFUL' || providerStatus === 'SUCCESS') {
      const { error: updateError } = await admin
        .from('donations')
        .update({ status: 'successful', updated_at: new Date().toISOString() })
        .eq('id', donation.id);

      if (updateError) {
        console.error('check-donation-status: Failed to update donation status to successful', updateError);
        return json({ error: 'DONATION_UPDATE_FAILED', message: 'Failed to update donation status.' }, 500);
      }

      return json({
        status: 'successful',
        amount: donation.amount,
        transId: targetTransId,
      });
    } else if (providerStatus === 'FAILED' || providerStatus === 'EXPIRED' || providerStatus === 'CANCELLED') {
      const { error: updateError } = await admin
        .from('donations')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', donation.id);

      if (updateError) {
        console.error('check-donation-status: Failed to update donation status to failed', updateError);
        return json({ error: 'DONATION_UPDATE_FAILED', message: 'Failed to update donation status.' }, 500);
      }

      return json({
        status: 'failed',
        amount: donation.amount,
        transId: targetTransId,
      });
    }

    return json({
      status: 'pending',
      amount: donation.amount,
      transId: targetTransId,
    });
  } catch (error) {
    console.error('check-donation-status unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Status check failed.' }, 500);
  }
});
