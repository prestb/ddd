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

    const body = await request.json().catch(() => ({}));
    const requestedLedger = ['payments', 'wallet', 'subscriptions', 'donations'].includes(body?.ledger) ? body.ledger : 'payments';
    const page = Math.max(1, Number(body?.page) || 1);
    const pageSize = Math.min(50, Math.max(5, Number(body?.pageSize) || 25));

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1. Get complete summary metrics across all tables via RPC
    const { data: summaryResult, error: summaryError } =
      await admin.rpc('get_admin_financial_summary');

    if (summaryError || !summaryResult) {
      console.error('admin-financials: financial summary RPC failed', summaryError);
      return json({
        error: 'FINANCIAL_SUMMARY_UNAVAILABLE',
        message: 'Financial summary could not be verified. Please try again.',
      }, 503);
    }

    const summary = summaryResult;

    // 2. Fetch paginated ledger rows based on requested ledger type
    let rowsData = [];
    let totalRows = 0;

    if (requestedLedger === 'payments') {
      totalRows = summary.countPayments ?? 0;
      const { data } = await admin
        .from('payment_transactions')
        .select('id, user_id, purpose, amount, currency, status, provider, provider_transaction_id, external_reference, created_at, metadata')
        .order('created_at', { ascending: false })
        .range(from, to);
      rowsData = data ?? [];
    } else if (requestedLedger === 'wallet') {
      totalRows = summary.countWalletTxs ?? 0;
      const { data } = await admin
        .from('wallet_transactions')
        .select('id, wallet_id, user_id, type, amount, balance_before, balance_after, reference, description, created_at, metadata')
        .order('created_at', { ascending: false })
        .range(from, to);
      rowsData = data ?? [];
    } else if (requestedLedger === 'subscriptions') {
      totalRows = summary.countSubTxs ?? 0;
      const { data } = await admin
        .from('subscription_transactions')
        .select('id, subscription_id, user_id, plan_id, type, amount, currency, wallet_transaction_id, created_at, metadata')
        .order('created_at', { ascending: false })
        .range(from, to);
      rowsData = data ?? [];
    } else if (requestedLedger === 'donations') {
      totalRows = summary.countDonations ?? 0;
      const { data } = await admin
        .from('donations')
        .select('id, user_id, amount, status, transaction_id, external_id, created_at, metadata')
        .order('created_at', { ascending: false })
        .range(from, to);
      rowsData = data ?? [];
    }

    return json({
      success: true,
      summary,
      ledger: requestedLedger,
      rows: rowsData,
      page,
      pageSize,
      total: totalRows,
      hasMore: (page * pageSize) < totalRows,
    });
  } catch (error) {
    console.error('admin-financials unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Financial fetch failed.' }, 500);
  }
});
