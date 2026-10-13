-- UX-08C / HARDENING PASS: Ensures purchase_subscription() automatically initializes a new user's wallet container with 0 XAF balance before locking.

create or replace function public.purchase_subscription(
  p_user_id uuid,
  p_plan_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_name text;
  v_duration_days integer;
  v_price_xaf integer;
  v_is_active boolean;
  v_wallet_id uuid;
  v_balance_before integer;
  v_balance_after integer;
  v_debit_result jsonb;
  v_wallet_tx_id uuid;
  v_subscription_id uuid;
  v_current_expires_at timestamptz;
  v_current_status text;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_sub_tx_id uuid;
begin
  if p_user_id is null or p_plan_id is null then
    raise exception 'User ID and Plan ID are required for subscription purchase.';
  end if;

  -- 1. Idempotency Check: if idempotency key already processed, return existing status safely
  if p_idempotency_key is not null and trim(p_idempotency_key) != '' then
    select subscription_id into v_subscription_id
    from public.subscription_transactions
    where metadata->>'idempotency_key' = p_idempotency_key;

    if v_subscription_id is not null then
      select balance into v_balance_after from public.wallets where user_id = p_user_id;
      select expires_at into v_expires_at from public.subscriptions where id = v_subscription_id;
      return jsonb_build_object(
        'status', 'already_processed',
        'subscription_id', v_subscription_id,
        'expires_at', v_expires_at,
        'remaining_balance', coalesce(v_balance_after, 0)
      );
    end if;
  end if;

  -- 2. Lock user's subscription row FOR UPDATE to serialize concurrent purchase requests
  select id, expires_at, status
  into v_subscription_id, v_current_expires_at, v_current_status
  from public.subscriptions
  where user_id = p_user_id
  for update;

  -- 3. Read authoritative subscription_plans row (never trust client-supplied price/duration)
  select name, duration_days, price_xaf, is_active
  into v_plan_name, v_duration_days, v_price_xaf, v_is_active
  from public.subscription_plans
  where id = p_plan_id;

  if v_plan_name is null or not v_is_active then
    raise exception 'Selected subscription plan is invalid or inactive.';
  end if;

  -- 4. Ensure wallet container exists for user with ON CONFLICT race protection
  insert into public.wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Lock wallet row FOR UPDATE & verify sufficient balance
  select id, balance into v_wallet_id, v_balance_before
  from public.wallets
  where user_id = p_user_id
  for update;

  if v_balance_before < v_price_xaf then
    raise exception 'INSUFFICIENT_BALANCE: Wallet balance (% XAF) is less than plan price (% XAF).', v_balance_before, v_price_xaf;
  end if;

  -- 5. Execute atomic debit_wallet() RPC
  v_debit_result := public.debit_wallet(
    p_user_id := p_user_id,
    p_amount := v_price_xaf,
    p_reference := coalesce(p_idempotency_key, 'sub-purchase-' || gen_random_uuid()::text),
    p_description := 'Daily Dew ' || v_plan_name || ' Membership Purchase',
    p_metadata := jsonb_build_object('plan_id', p_plan_id, 'plan_name', v_plan_name)
  );

  v_wallet_tx_id := (v_debit_result->>'transaction_id')::uuid;
  v_balance_after := (v_debit_result->>'balance_after')::integer;

  -- 6. Calculate server-side authoritative timestamps with extension from unexpired balance
  v_starts_at := now();
  v_expires_at := greatest(coalesce(v_current_expires_at, now()), now()) + (v_duration_days || ' days')::interval;

  -- 7. Upsert public.subscriptions row for user (Guarantees single active subscription container)
  insert into public.subscriptions (
    user_id,
    plan_id,
    status,
    started_at,
    expires_at,
    auto_renew,
    updated_at
  )
  values (
    p_user_id,
    p_plan_id,
    'active',
    v_starts_at,
    v_expires_at,
    true,
    now()
  )
  on conflict (user_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    started_at = excluded.started_at,
    expires_at = excluded.expires_at,
    updated_at = now()
  returning id into v_subscription_id;

  -- 8. Insert public.subscription_transactions row
  insert into public.subscription_transactions (
    subscription_id,
    user_id,
    plan_id,
    type,
    amount,
    currency,
    wallet_transaction_id,
    metadata
  )
  values (
    v_subscription_id,
    p_user_id,
    p_plan_id,
    'purchase',
    v_price_xaf,
    'XAF',
    v_wallet_tx_id,
    jsonb_build_object('idempotency_key', p_idempotency_key, 'plan_name', v_plan_name)
  )
  returning id into v_sub_tx_id;

  return jsonb_build_object(
    'status', 'successful',
    'subscription_id', v_subscription_id,
    'subscription_transaction_id', v_sub_tx_id,
    'wallet_transaction_id', v_wallet_tx_id,
    'plan_name', v_plan_name,
    'price_xaf', v_price_xaf,
    'started_at', v_starts_at,
    'expires_at', v_expires_at,
    'remaining_balance', v_balance_after
  );

exception
  when unique_violation then
    -- Concurrent duplicate request caught by sub_tx_idempotency_key_idx or user_id constraint!
    -- Sub-transaction automatically rolls back wallet debit and returns idempotent status safely.
    select balance into v_balance_after from public.wallets where user_id = p_user_id;
    select id, expires_at into v_subscription_id, v_expires_at from public.subscriptions where user_id = p_user_id;
    return jsonb_build_object(
      'status', 'already_processed',
      'subscription_id', v_subscription_id,
      'expires_at', v_expires_at,
      'remaining_balance', coalesce(v_balance_after, 0)
    );
end;
$$;

revoke execute on function public.purchase_subscription(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.purchase_subscription(uuid, uuid, text) to service_role, postgres;
