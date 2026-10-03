-- UX-08B-2 CORRECTION: Trusted Wallet RPCs & Atomic Payment Processing
-- Provides atomic, locked, non-negative wallet credit, debit, and deposit processing functions.
-- Executable strictly by service_role (trusted backend Edge Functions).

-- 1. CREDIT WALLET RPC (Concurrent wallet creation race-proof)
create or replace function public.credit_wallet(
  p_user_id uuid,
  p_amount integer,
  p_reference text default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance_before integer;
  v_balance_after integer;
  v_tx_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Wallet credit amount must be greater than zero.';
  end if;

  -- Ensure wallet container exists with ON CONFLICT race protection
  insert into public.wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Lock wallet row for update
  select id, balance into v_wallet_id, v_balance_before
  from public.wallets
  where user_id = p_user_id
  for update;

  v_balance_after := v_balance_before + p_amount;

  -- Insert atomic wallet transaction ledger entry
  insert into public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    reference,
    description,
    metadata
  )
  values (
    v_wallet_id,
    p_user_id,
    'credit',
    p_amount,
    v_balance_before,
    v_balance_after,
    p_reference,
    coalesce(p_description, 'Account balance deposit'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_tx_id;

  -- Update wallet balance
  update public.wallets
  set balance = v_balance_after, updated_at = now()
  where id = v_wallet_id;

  return jsonb_build_object(
    'wallet_id', v_wallet_id,
    'transaction_id', v_tx_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'amount', p_amount
  );
end;
$$;

-- 2. DEBIT WALLET RPC
create or replace function public.debit_wallet(
  p_user_id uuid,
  p_amount integer,
  p_reference text default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance_before integer;
  v_balance_after integer;
  v_tx_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Wallet debit amount must be greater than zero.';
  end if;

  -- Lock wallet row for update
  select id, balance into v_wallet_id, v_balance_before
  from public.wallets
  where user_id = p_user_id
  for update;

  if v_wallet_id is null then
    raise exception 'Wallet does not exist for the specified user.';
  end if;

  if v_balance_before < p_amount then
    raise exception 'Insufficient wallet balance for this operation.';
  end if;

  v_balance_after := v_balance_before - p_amount;

  -- Insert atomic wallet debit ledger entry
  insert into public.wallet_transactions (
    wallet_id,
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    reference,
    description,
    metadata
  )
  values (
    v_wallet_id,
    p_user_id,
    'debit',
    p_amount,
    v_balance_before,
    v_balance_after,
    p_reference,
    coalesce(p_description, 'Account balance debit'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_tx_id;

  -- Update wallet balance
  update public.wallets
  set balance = v_balance_after, updated_at = now()
  where id = v_wallet_id;

  return jsonb_build_object(
    'wallet_id', v_wallet_id,
    'transaction_id', v_tx_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'amount', p_amount
  );
end;
$$;

-- 3. ATOMIC PAYMENT PROCESSING RPC (Concurrent Duplicate Webhook Safe)
create or replace function public.process_verified_wallet_deposit(
  p_provider_transaction_id text,
  p_provider_amount integer default null,
  p_webhook_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_user_id uuid;
  v_expected_amount integer;
  v_status text;
  v_purpose text;
  v_credit_result jsonb;
begin
  if p_provider_transaction_id is null or trim(p_provider_transaction_id) = '' then
    raise exception 'Provider transaction ID is required.';
  end if;

  -- Row Locking: Lock payment_transactions row FOR UPDATE to block concurrent duplicate webhooks
  select id, user_id, amount, status, purpose
  into v_payment_id, v_user_id, v_expected_amount, v_status, v_purpose
  from public.payment_transactions
  where provider_transaction_id = p_provider_transaction_id
  for update;

  if v_payment_id is null then
    return jsonb_build_object('status', 'not_found', 'credited', false);
  end if;

  -- IDEMPOTENCY GUARD: If already marked successful, return idempotent response safely
  if v_status = 'successful' then
    return jsonb_build_object('status', 'already_processed', 'credited', false);
  end if;

  if v_purpose != 'wallet_deposit' then
    raise exception 'Invalid payment transaction purpose.';
  end if;

  -- Verify provider amount matches expected amount
  if p_provider_amount is not null and p_provider_amount > 0 and p_provider_amount != v_expected_amount then
    update public.payment_transactions
    set status = 'failed',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('error', 'Amount mismatch'),
        updated_at = now()
    where id = v_payment_id;

    return jsonb_build_object('status', 'amount_mismatch', 'credited', false);
  end if;

  -- Execute atomic wallet credit (locks wallet row, inserts ledger row, updates balance)
  v_credit_result := public.credit_wallet(
    p_user_id := v_user_id,
    p_amount := v_expected_amount,
    p_reference := p_provider_transaction_id,
    p_description := 'Mobile Money Deposit (' || p_provider_transaction_id || ')',
    p_metadata := coalesce(p_webhook_metadata, '{}'::jsonb)
  );

  -- Transition payment_transactions status to successful in the SAME atomic transaction
  update public.payment_transactions
  set status = 'successful',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('credit_result', v_credit_result),
      updated_at = now()
  where id = v_payment_id;

  return jsonb_build_object(
    'status', 'successful',
    'credited', true,
    'payment_id', v_payment_id,
    'user_id', v_user_id,
    'amount', v_expected_amount,
    'credit_result', v_credit_result
  );
end;
$$;

-- Restrict execution privileges: Only service_role & postgres can execute wallet RPCs
revoke execute on function public.credit_wallet(uuid, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.credit_wallet(uuid, integer, text, text, jsonb) to service_role, postgres;

revoke execute on function public.debit_wallet(uuid, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.debit_wallet(uuid, integer, text, text, jsonb) to service_role, postgres;

revoke execute on function public.process_verified_wallet_deposit(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.process_verified_wallet_deposit(text, integer, jsonb) to service_role, postgres;
