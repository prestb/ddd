-- UX-10 FINAL DIAGNOSTIC FIX: Allows process_verified_wallet_deposit to match payment_transactions by provider_transaction_id OR external_reference.
-- Ensures that wallet deposits are found and credited seamlessly even if matching by external_reference.

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

  -- Row Locking: Lock payment_transactions row FOR UPDATE matching provider_transaction_id OR external_reference
  select id, user_id, amount, status, purpose
  into v_payment_id, v_user_id, v_expected_amount, v_status, v_purpose
  from public.payment_transactions
  where provider_transaction_id = p_provider_transaction_id
     or external_reference = p_provider_transaction_id
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

  -- Transition payment_transactions status to successful and ensure provider_transaction_id is set
  update public.payment_transactions
  set status = 'successful',
      provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id),
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

revoke execute on function public.process_verified_wallet_deposit(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.process_verified_wallet_deposit(text, integer, jsonb) to service_role, postgres;
