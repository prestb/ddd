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
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return json({ error: 'UNAUTHORIZED', message: 'Authentication required.' }, 401);
    }

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: adminUser }, error: authError } = await authClient.auth.getUser();

    if (authError || !adminUser) {
      return json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is an administrator
    const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', adminUser.id).maybeSingle();
    if (adminProfile?.role !== 'admin') {
      return json({ error: 'FORBIDDEN', message: 'Only Ministry Administrators can access financial ledgers.' }, 403);
    }

    // Query financial ledgers across all accounting tables
    const [
      { data: paymentTxs },
      { data: walletTxs },
      { data: subscriptionTxs },
      { data: donations },
      { data: activeSubscriptions },
      { data: walletBalances },
      { data: subscriptionPlans },
    ] = await Promise.all([
      admin.from('payment_transactions').select('id, user_id, purpose, amount, currency, status, provider, provider_transaction_id, external_reference, created_at, metadata').order('created_at', { ascending: false }).limit(50),
      admin.from('wallet_transactions').select('id, wallet_id, user_id, type, amount, balance_before, balance_after, reference, description, created_at, metadata').order('created_at', { ascending: false }).limit(50),
      admin.from('subscription_transactions').select('id, subscription_id, user_id, plan_id, type, amount, currency, wallet_transaction_id, created_at, metadata').order('created_at', { ascending: false }).limit(50),
      admin.from('donations').select('id, user_id, amount, status, transaction_id, external_id, created_at, metadata').order('created_at', { ascending: false }).limit(50),
      admin.from('subscriptions').select('id, user_id, plan_id, status, started_at, expires_at, auto_renew').eq('status', 'active'),
      admin.from('wallets').select('user_id, balance, updated_at'),
      admin.from('subscription_plans').select('id, name, duration_days, price_xaf, is_active'),
    ]);

    const totalSuccessfulDepositXaf = (paymentTxs ?? [])
      .filter((tx) => tx.status === 'successful' && tx.purpose === 'wallet_deposit')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);

    const totalDonationsXaf = (donations ?? [])
      .filter((d) => d.status === 'successful')
      .reduce((acc, d) => acc + (d.amount || 0), 0);

    const totalSubscriptionRevenueXaf = (subscriptionTxs ?? [])
      .reduce((acc, stx) => acc + (stx.amount || 0), 0);

    const activeSubscribersCount = (activeSubscriptions ?? []).length;
    const totalWalletBalanceXaf = (walletBalances ?? []).reduce((acc, w) => acc + (w.balance || 0), 0);

    return json({
      success: true,
      summary: {
        totalSuccessfulDepositXaf,
        totalDonationsXaf,
        totalSubscriptionRevenueXaf,
        activeSubscribersCount,
        totalWalletBalanceXaf,
        recentTxCount: (paymentTxs ?? []).length,
      },
      paymentTransactions: paymentTxs ?? [],
      walletTransactions: walletTxs ?? [],
      subscriptionTransactions: subscriptionTxs ?? [],
      donations: donations ?? [],
      activeSubscriptions: activeSubscriptions ?? [],
      wallets: walletBalances ?? [],
      subscriptionPlans: subscriptionPlans ?? [],
    });
  } catch (error) {
    console.error('admin-financials unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Financial fetch failed.' }, 500);
  }
});
