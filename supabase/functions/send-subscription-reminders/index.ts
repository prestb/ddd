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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const in3DaysStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 0, 0, 0);
    const in3DaysEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59, 59);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 1. Subscriptions expiring in 3 days
    const { data: subs3Days } = await admin
      .from('subscriptions')
      .select('id, user_id, status, expires_at, auto_renew')
      .eq('status', 'active')
      .gte('expires_at', in3DaysStart.toISOString())
      .lte('expires_at', in3DaysEnd.toISOString());

    // 2. Subscriptions expiring today
    const { data: subsToday } = await admin
      .from('subscriptions')
      .select('id, user_id, status, expires_at, auto_renew')
      .eq('status', 'active')
      .gte('expires_at', todayStart.toISOString())
      .lte('expires_at', todayEnd.toISOString());

    const remindersSent = [];

    // Process 3-day reminders
    for (const sub of subs3Days ?? []) {
      const { data: wallet } = await admin
        .from('wallets')
        .select('balance')
        .eq('user_id', sub.user_id)
        .maybeSingle();

      const lowBalance = (wallet?.balance ?? 0) < 500;
      remindersSent.push({
        userId: sub.user_id,
        type: '3_days_notice',
        autoRenew: sub.auto_renew,
        lowBalance,
        expiresAt: sub.expires_at,
      });

      await admin.from('app_events').insert({
        user_id: sub.user_id,
        event_type: 'subscription_reminder_3_days',
        metadata: { expires_at: sub.expires_at, auto_renew: sub.auto_renew, low_balance: lowBalance },
      });
    }

    // Process day-of reminders
    for (const sub of subsToday ?? []) {
      const { data: wallet } = await admin
        .from('wallets')
        .select('balance')
        .eq('user_id', sub.user_id)
        .maybeSingle();

      const lowBalance = (wallet?.balance ?? 0) < 500;
      remindersSent.push({
        userId: sub.user_id,
        type: 'expiration_day_notice',
        autoRenew: sub.auto_renew,
        lowBalance,
        expiresAt: sub.expires_at,
      });

      await admin.from('app_events').insert({
        user_id: sub.user_id,
        event_type: 'subscription_reminder_today',
        metadata: { expires_at: sub.expires_at, auto_renew: sub.auto_renew, low_balance: lowBalance },
      });
    }

    return json({
      success: true,
      processed3DaysCount: (subs3Days ?? []).length,
      processedTodayCount: (subsToday ?? []).length,
      reminders: remindersSent,
    });
  } catch (error) {
    console.error('send-subscription-reminders unhandled exception', error);
    return json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Could not process subscription reminders right now.',
      },
      500
    );
  }
});
