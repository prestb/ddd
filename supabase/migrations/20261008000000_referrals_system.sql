-- Migration: Referrals System
-- Adds referral_code to profiles, creates referrals table, RLS policies, and fulfillment RPC

-- 1. Add referral_code to profiles table if missing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Trigger function to auto-generate referral code DEW-XXXXXX for new profiles
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'DEW-' || UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_referral_code ON profiles;
CREATE TRIGGER tr_generate_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION generate_unique_referral_code();

-- Populate referral_code for existing profiles that have null code
UPDATE profiles
SET referral_code = 'DEW-' || UPPER(SUBSTRING(MD5(id::text || NOW()::text) FROM 1 FOR 6))
WHERE referral_code IS NULL;

-- 3. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  reward_amount_xaf INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rewarded_at TIMESTAMPTZ,
  CONSTRAINT chk_no_self_referral CHECK (referrer_id <> referred_user_id)
);

-- Index for fast lookup by referred_user_id and referrer_id
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

-- 4. Enable RLS on referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own referral records" ON referrals;
CREATE POLICY "Users can view their own referral records"
ON referrals FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

DROP POLICY IF EXISTS "Authenticated users can create a referral for themselves" ON referrals;
CREATE POLICY "Authenticated users can create a referral for themselves"
ON referrals FOR INSERT
WITH CHECK (auth.uid() = referred_user_id);

-- 5. RPC function to fulfill referral reward upon first subscription purchase
CREATE OR REPLACE FUNCTION fulfill_referral_reward(p_referred_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
BEGIN
  -- 1. Find pending referral
  SELECT * INTO v_referral FROM referrals
  WHERE referred_user_id = p_referred_user_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_pending_referral');
  END IF;

  -- 2. Lock & update referrer's wallet
  SELECT id, balance INTO v_wallet_id, v_balance_before
  FROM wallets WHERE user_id = v_referral.referrer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    -- Ensure referrer wallet exists if missing
    INSERT INTO wallets (user_id, balance) VALUES (v_referral.referrer_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance_before;
  END IF;

  v_balance_after := v_balance_before + v_referral.reward_amount_xaf;

  UPDATE wallets SET balance = v_balance_after, updated_at = NOW() WHERE id = v_wallet_id;

  -- 3. Record wallet transaction log
  INSERT INTO wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, v_referral.referrer_id, 'credit', v_referral.reward_amount_xaf,
    v_balance_before, v_balance_after, 'ref-' || v_referral.id, 'Referral reward for inviting a friend'
  );

  -- 4. Mark referral as rewarded
  UPDATE referrals SET status = 'rewarded', rewarded_at = NOW() WHERE id = v_referral.id;

  RETURN jsonb_build_object('status', 'rewarded', 'amount', v_referral.reward_amount_xaf);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
