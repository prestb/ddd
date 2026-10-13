-- Migration: Admin Manual Referral Credit, RPC Setting Fallbacks & Schema Cache Reload

-- 1. Stored RPC: Admin Credit User Referral Wallet
CREATE OR REPLACE FUNCTION admin_credit_user_referral_wallet(
  p_target_user_id UUID,
  p_amount_xaf INTEGER,
  p_description TEXT DEFAULT 'Manual admin referral credit'
)
RETURNS JSONB AS $$
DECLARE
  v_caller_role TEXT;
  v_wallet_id UUID;
  v_ref_before INTEGER;
  v_ref_after INTEGER;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only Ministry Administrators can credit wallets.');
  END IF;

  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than 0.');
  END IF;

  -- Lock target wallet
  SELECT id, referral_balance INTO v_wallet_id, v_ref_before
  FROM wallets WHERE user_id = p_target_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, referral_balance) VALUES (p_target_user_id, 0, 0)
    RETURNING id, referral_balance INTO v_wallet_id, v_ref_before;
  END IF;

  v_ref_before := COALESCE(v_ref_before, 0);
  v_ref_after := v_ref_before + p_amount_xaf;

  UPDATE wallets SET referral_balance = v_ref_after, updated_at = NOW() WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, p_target_user_id, 'referral_credit', p_amount_xaf,
    v_ref_before, v_ref_after, 'admin-credit-' || extract(epoch from now())::text,
    COALESCE(p_description, 'Manual admin referral wallet credit (' || p_amount_xaf || ' XAF)')
  );

  RETURN jsonb_build_object('success', true, 'new_referral_balance', v_ref_after, 'amount', p_amount_xaf);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Stored RPC: Get App Setting (bypasses REST schema cache issues)
CREATE OR REPLACE FUNCTION get_app_setting(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
  v_val TEXT;
BEGIN
  SELECT value INTO v_val FROM app_settings WHERE key = p_key;
  RETURN COALESCE(v_val, '10');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Stored RPC: Set App Setting (bypasses REST schema cache issues)
CREATE OR REPLACE FUNCTION set_app_setting(p_key TEXT, p_value TEXT)
RETURNS JSONB AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only Ministry Administrators can update app settings.');
  END IF;

  INSERT INTO app_settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
