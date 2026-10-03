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

    // Query financial ledgers
    const [
      { data: paymentTxs },
      { data: donations },
      { data: activeSubscriptions },
      { data: walletBalances },
    ] = await Promise.all([
      admin.from('payment_transactions').select('id, user_id, purpose, amount, currency, status, provider, provider_transaction_id, external_reference, created_at, metadata').order('created_at', { ascending: false }).limit(50),
      admin.from('donations').select('id, user_id, amount, status, transaction_id, external_id, created_at, metadata').order('created_at', { ascending: false }).limit(50),
      admin.from('subscriptions').select('id, user_id, plan_id, status, started_at, expires_at, auto_renew').eq('status', 'active'),
      admin.from('wallets').select('user_id, balance, updated_at'),
    ]);

    const totalSuccessfulDepositXaf = (paymentTxs ?? [])
      .filter((tx) => tx.status === 'successful' && tx.purpose === 'wallet_deposit')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);

    const totalDonationsXaf = (donations ?? [])
      .filter((d) => d.status === 'successful')
      .reduce((acc, d) => acc + (d.amount || 0), 0);

    const activeSubscribersCount = (activeSubscriptions ?? []).length;
    const totalWalletBalanceXaf = (walletBalances ?? []).reduce((acc, w) => acc + (w.balance || 0), 0);

    return json({
      success: true,
      summary: {
        totalSuccessfulDepositXaf,
        totalDonationsXaf,
        activeSubscribersCount,
        totalWalletBalanceXaf,
        recentTxCount: (paymentTxs ?? []).length,
      },
      paymentTransactions: paymentTxs ?? [],
      donations: donations ?? [],
      activeSubscriptions: activeSubscriptions ?? [],
      wallets: walletBalances ?? [],
    });
  } catch (error) {
    console.error('admin-financials unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Financial fetch failed.' }, 500);
  }
});
