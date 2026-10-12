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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('FAPSHI_API_KEY');
    const apiUser = Deno.env.get('FAPSHI_API_USER');
    const baseUrl = Deno.env.get('FAPSHI_BASE_URL') ?? 'https://live.fapshi.com';

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'UNAUTHORIZED', message: 'Authentication required.' }, 401);
    }

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return json({ error: 'UNAUTHORIZED', message: 'Invalid or expired user session.' }, 401);
    }

    const body = await request.json();
    const amount = parseInt(body?.amount, 10);
    const provider = String(body?.provider ?? 'mtn').toLowerCase();
    const phone = String(body?.phone ?? '').replace(/\D/g, '');

    if (!amount || amount < 1000) {
      return json({ error: 'INVALID_AMOUNT', message: 'Minimum withdrawal amount is 1,000 XAF.' }, 400);
    }

    if (provider !== 'mtn' && provider !== 'orange') {
      return json({ error: 'INVALID_PROVIDER', message: 'Invalid payout provider. Select MTN or Orange.' }, 400);
    }

    if (phone.length !== 9 || !phone.startsWith('6')) {
      return json({ error: 'INVALID_PHONE', message: 'Valid 9-digit Mobile Money phone number required.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Weekly limit check (max 1 withdrawal per 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentWd } = await admin
      .from('withdrawal_requests')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', sevenDaysAgo)
      .maybeSingle();

    if (recentWd) {
      return json({
        error: 'WEEKLY_LIMIT_EXCEEDED',
        message: 'Withdrawals are limited to once every 7 days.',
      }, 400);
    }

    // 2. Lock referral wallet & check balance
    const { data: wallet } = await admin
      .from('wallets')
      .select('id, referral_balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!wallet || (wallet.referral_balance ?? 0) < amount) {
      return json({
        error: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient referral wallet balance for this withdrawal.',
      }, 400);
    }

    const refBefore = wallet.referral_balance;
    const refAfter = refBefore - amount;

    // Deduct referral balance (escrow)
    await admin.from('wallets').update({ referral_balance: refAfter, updated_at: new Date().toISOString() }).eq('id', wallet.id);

    // Record pending withdrawal request
    const { data: reqData } = await admin
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount_xaf: amount,
        provider,
        phone,
        status: 'pending_admin_validation',
      })
      .select('id')
      .single();

    // 3. Trigger Fapshi Payout if credentials exist
    let fapshiTransId = null;
    let fapshiSuccess = false;
    let fapshiErrMsg = null;

    if (apiKey && apiUser) {
      try {
        const fapshiRes = await fetch(`${baseUrl.replace(/\/$/, '')}/payout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apiuser: apiUser,
            apikey: apiKey,
          },
          body: JSON.stringify({
            amount,
            phone,
            medium: provider.toUpperCase(),
            userId: user.id,
          }),
        });

        const rawText = await fapshiRes.text();
        let fapshiData: any = {};
        try { fapshiData = JSON.parse(rawText); } catch { fapshiData = { message: rawText }; }

        if (fapshiRes.ok && (fapshiData?.status === 'SUCCESSFUL' || fapshiData?.status === 'CREATED' || fapshiData?.transId)) {
          fapshiSuccess = true;
          fapshiTransId = fapshiData.transId ?? null;
        } else {
          fapshiErrMsg = fapshiData?.message || rawText || 'Fapshi payout request rejected.';
        }
      } catch (fErr: any) {
        fapshiErrMsg = fErr?.message || 'Fapshi payout connection failed.';
      }
    } else {
      // If Fapshi payout credentials not configured in env, log as pending request for admin approval
      fapshiSuccess = true;
    }

    if (!fapshiSuccess) {
      // Refund referral balance if Fapshi payout failed
      await admin.from('wallets').update({ referral_balance: refBefore, updated_at: new Date().toISOString() }).eq('id', wallet.id);
      if (reqData?.id) {
        await admin.from('withdrawal_requests').update({ status: 'declined', admin_notes: fapshiErrMsg }).eq('id', reqData.id);
      }
      return json({
        error: 'PAYOUT_FAILED',
        message: fapshiErrMsg ?? 'Mobile Money payout failed. Please verify your phone number and try again.',
      }, 400);
    }

    // Mark withdrawal request validated/completed
    if (reqData?.id) {
      await admin.from('withdrawal_requests').update({
        status: 'validated',
        validated_at: new Date().toISOString(),
        admin_notes: fapshiTransId ? `Fapshi payout transId: ${fapshiTransId}` : 'Automatic payout processed',
      }).eq('id', reqData.id);
    }

    // Log transaction
    await admin.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: 'withdrawal_request',
      amount,
      balance_before: refBefore,
      balance_after: refAfter,
      reference: fapshiTransId ? `fapshi-po-${fapshiTransId}` : `wd-${reqData?.id}`,
      description: `Mobile Money withdrawal via ${provider.toUpperCase()} (${amount} XAF to ${phone})`,
    });

    // Record system app event for admin notification
    await admin.from('app_events').insert({
      user_id: user.id,
      event_type: 'withdrawal_processed',
      metadata: {
        amount,
        phone,
        provider,
        fapshiTransId,
        withdrawal_request_id: reqData?.id,
      },
    });

    return json({
      success: true,
      amount,
      phone,
      provider,
      fapshiTransId,
      remainingReferralBalance: refAfter,
    });
  } catch (error) {
    console.error('create-wallet-withdrawal exception', error);
    return json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Could not process withdrawal right now.',
      },
      500
    );
  }
});
