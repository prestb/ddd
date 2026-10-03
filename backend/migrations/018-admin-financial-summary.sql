-- UX-11 ADMIN OPERATIONS: Security Definer Financial Summary RPC Function
-- Calculates exact summary metrics directly across full underlying accounting tables without table limit truncations.

create or replace function public.get_admin_financial_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_admin boolean;
  v_total_deposits integer;
  v_total_donations integer;
  v_total_sub_revenue integer;
  v_active_subscribers integer;
  v_total_wallet_balance integer;
  v_count_payments integer;
  v_count_wallet_txs integer;
  v_count_sub_txs integer;
  v_count_donations integer;
begin
  v_user_id := auth.uid();

  -- Verify administrator role if user session is present
  if v_user_id is not null then
    select exists (
      select 1 from public.profiles p where p.id = v_user_id and p.role = 'admin'
    ) into v_is_admin;

    if not v_is_admin then
      raise exception 'Only Ministry Administrators can access financial summaries.';
    end if;
  end if;

  -- Calculate total successful wallet deposits in XAF
  select coalesce(sum(amount), 0), count(*)
  into v_total_deposits, v_count_payments
  from public.payment_transactions
  where status = 'successful' and purpose = 'wallet_deposit';

  -- Calculate total successful donations in XAF
  select coalesce(sum(amount), 0), count(*)
  into v_total_donations, v_count_donations
  from public.donations
  where status = 'successful';

  -- Calculate total subscription revenue in XAF
  select coalesce(sum(amount), 0), count(*)
  into v_total_sub_revenue, v_count_sub_txs
  from public.subscription_transactions;

  -- Calculate active subscribers count
  select count(*)
  into v_active_subscribers
  from public.subscriptions
  where status = 'active' and expires_at > now();

  -- Calculate total wallet balance liabilities in XAF
  select coalesce(sum(balance), 0)
  into v_total_wallet_balance
  from public.wallets;

  -- Calculate wallet transactions count
  select count(*)
  into v_count_wallet_txs
  from public.wallet_transactions;

  return jsonb_build_object(
    'totalSuccessfulDepositXaf', v_total_deposits,
    'totalDonationsXaf', v_total_donations,
    'totalSubscriptionRevenueXaf', v_total_sub_revenue,
    'activeSubscribersCount', v_active_subscribers,
    'totalWalletBalanceXaf', v_total_wallet_balance,
    'countPayments', v_count_payments,
    'countWalletTxs', v_count_wallet_txs,
    'countSubTxs', v_count_sub_txs,
    'countDonations', v_count_donations
  );
end;
$$;

revoke execute on function public.get_admin_financial_summary() from public, anon;
grant execute on function public.get_admin_financial_summary() to service_role, postgres, authenticated;
