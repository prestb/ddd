-- Migration: Percentage Referrals, Dual Wallets, Withdrawals & App Settings

-- 1. App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default referral_percentage = 10 if not present
INSERT INTO app_settings (key, value, description)
VALUES ('referral_percentage', '10', 'Percentage commission awarded to referrers upon subscription purchase')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS on app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read app settings" ON app_settings;
CREATE POLICY "Public can read app settings"
ON app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;
CREATE POLICY "Admins can update app settings"
ON app_settings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. Add referral_balance to wallets table
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS referral_balance INTEGER NOT NULL DEFAULT 0;

-- 3. Withdrawal Requests Table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_xaf INTEGER NOT NULL CHECK (amount_xaf >= 1000),
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'orange')),
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_admin_validation' CHECK (status IN ('pending_admin_validation', 'validated', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Users can view their own withdrawal requests"
ON withdrawal_requests FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view and update all withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Admins can view and update all withdrawal requests"
ON withdrawal_requests FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Dynamic Percentage Fulfill Referral Reward RPC
CREATE OR REPLACE FUNCTION fulfill_referral_reward(p_referred_user_id UUID, p_subscription_price_xaf INTEGER DEFAULT 500)
RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_percentage_str TEXT;
  v_percentage INTEGER := 10;
  v_reward_amount INTEGER;
BEGIN
  -- Fetch referral_percentage from app_settings
  SELECT value INTO v_percentage_str FROM app_settings WHERE key = 'referral_percentage';
  IF v_percentage_str IS NOT NULL AND v_percentage_str ~ '^\d+$' THEN
    v_percentage := v_percentage_str::INTEGER;
  END IF;

  -- Calculate percentage reward
  v_reward_amount := ROUND((COALESCE(p_subscription_price_xaf, 500) * v_percentage) / 100.0);
  IF v_reward_amount < 50 THEN
    v_reward_amount := 50;
  END IF;

  -- Lock pending referral
  SELECT * INTO v_referral FROM referrals
  WHERE referred_user_id = p_referred_user_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_pending_referral');
  END IF;

  -- Lock referrer wallet
  SELECT id, referral_balance INTO v_wallet_id, v_balance_before
  FROM wallets WHERE user_id = v_referral.referrer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, referral_balance) VALUES (v_referral.referrer_id, 0, 0)
    RETURNING id, referral_balance INTO v_wallet_id, v_balance_before;
  END IF;

  v_balance_after := v_balance_before + v_reward_amount;

  UPDATE wallets SET referral_balance = v_balance_after, updated_at = NOW() WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, v_referral.referrer_id, 'referral_credit', v_reward_amount,
    v_balance_before, v_balance_after, 'ref-' || v_referral.id,
    v_percentage || '% referral commission on subscription purchase (' || v_reward_amount || ' XAF)'
  );

  UPDATE referrals
  SET status = 'rewarded', rewarded_at = NOW(), reward_amount_xaf = v_reward_amount
  WHERE id = v_referral.id;

  RETURN jsonb_build_object('status', 'rewarded', 'amount', v_reward_amount, 'percentage', v_percentage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Transfer Referral Wallet -> Deposit Wallet
CREATE OR REPLACE FUNCTION transfer_referral_to_deposit_wallet(p_user_id UUID, p_amount_xaf INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_ref_before INTEGER;
  v_ref_after INTEGER;
  v_dep_before INTEGER;
  v_dep_after INTEGER;
BEGIN
  IF p_amount_xaf < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum transfer amount is 100 XAF.');
  END IF;

  SELECT id, balance, referral_balance INTO v_wallet_id, v_dep_before, v_ref_before
  FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
  END IF;

  IF v_ref_before < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient referral wallet balance.');
  END IF;

  v_ref_after := v_ref_before - p_amount_xaf;
  v_dep_after := v_dep_before + p_amount_xaf;

  UPDATE wallets
  SET referral_balance = v_ref_after, balance = v_dep_after, updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, p_user_id, 'transfer_to_deposit', p_amount_xaf,
    v_ref_before, v_ref_after, 'trf-' || Date.now()::text,
    'Transfer from referral wallet to deposit balance (' || p_amount_xaf || ' XAF)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'transferred', p_amount_xaf,
    'deposit_balance', v_dep_after,
    'referral_balance', v_ref_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Request Wallet Withdrawal (Min 1,000 XAF, Once per week limit)
CREATE OR REPLACE FUNCTION request_wallet_withdrawal(
  p_user_id UUID,
  p_amount_xaf INTEGER,
  p_provider TEXT,
  p_phone TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_ref_before INTEGER;
  v_ref_after INTEGER;
  v_last_request TIMESTAMPTZ;
  v_request_id UUID;
BEGIN
  IF p_amount_xaf < 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is 1,000 XAF.');
  END IF;

  IF p_provider NOT IN ('mtn', 'orange') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payout provider.');
  END IF;

  -- Frequency check: max once per 7 days
  SELECT created_at INTO v_last_request
  FROM withdrawal_requests
  WHERE user_id = p_user_id AND created_at > (NOW() - INTERVAL '7 days')
  ORDER BY created_at DESC LIMIT 1;

  IF v_last_request IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Withdrawals are limited to once per week. Next eligible withdrawal date: ' || (v_last_request + INTERVAL '7 days')::text
    );
  END IF;

  -- Lock referral wallet balance
  SELECT id, referral_balance INTO v_wallet_id, v_ref_before
  FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet_id IS NULL OR v_ref_before < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient referral wallet balance for withdrawal.');
  END IF;

  v_ref_after := v_ref_before - p_amount_xaf;

  -- Hold funds in escrow by deducting from referral balance
  UPDATE wallets SET referral_balance = v_ref_after, updated_at = NOW() WHERE id = v_wallet_id;

  INSERT INTO withdrawal_requests (
    user_id, amount_xaf, provider, phone, status
  ) VALUES (
    p_user_id, p_amount_xaf, p_provider, p_phone, 'pending_admin_validation'
  ) RETURNING id INTO v_request_id;

  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, p_user_id, 'withdrawal_request', p_amount_xaf,
    v_ref_before, v_ref_after, 'wd-' || v_request_id::text,
    'Withdrawal request via ' || UPPER(p_provider) || ' (' || p_amount_xaf || ' XAF)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount', p_amount_xaf,
    'remaining_referral_balance', v_ref_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Admin Process Withdrawal Request (Validate or Decline)
CREATE OR REPLACE FUNCTION admin_process_withdrawal_request(
  p_request_id UUID,
  p_action TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
  v_wallet_id UUID;
  v_ref_before INTEGER;
  v_ref_after INTEGER;
  v_caller_role TEXT;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only Ministry Administrators can process payouts.');
  END IF;

  SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found.');
  END IF;

  IF v_request.status <> 'pending_admin_validation' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request has already been processed.');
  END IF;

  IF p_action = 'validate' THEN
    UPDATE withdrawal_requests
    SET status = 'validated', validated_at = NOW(), admin_notes = p_admin_notes
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'validated');

  ELSIF p_action = 'decline' THEN
    -- Refund held amount back to user referral_balance
    SELECT id, referral_balance INTO v_wallet_id, v_ref_before
    FROM wallets WHERE user_id = v_request.user_id FOR UPDATE;

    v_ref_after := COALESCE(v_ref_before, 0) + v_request.amount_xaf;

    UPDATE wallets SET referral_balance = v_ref_after, updated_at = NOW() WHERE id = v_wallet_id;

    UPDATE withdrawal_requests
    SET status = 'declined', validated_at = NOW(), admin_notes = p_admin_notes
    WHERE id = p_request_id;

    INSERT INTO wallet_transactions (
      wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
    ) VALUES (
      v_wallet_id, v_request.user_id, 'withdrawal_declined_refund', v_request.amount_xaf,
      v_ref_before, v_ref_after, 'wd-ref-' || v_request.id::text,
      'Refund for declined withdrawal request (' || v_request.amount_xaf || ' XAF)'
    );

    RETURN jsonb_build_object('success', true, 'status', 'declined', 'refunded', v_request.amount_xaf);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Must be validate or decline.');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
