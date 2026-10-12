-- ============================================================================
-- DAILY DEW DEVOTIONAL - COMPLETE SUPABASE DATABASE SETUP SCRIPT
-- Copy and paste this script directly into your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (key, value, description)
VALUES ('referral_percentage', '10', 'Percentage commission awarded to referrers upon subscription purchase')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read app settings" ON public.app_settings;
CREATE POLICY "Public can read app settings"
ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings"
ON public.app_settings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. Profiles Table Referral Code Column & Trigger
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'DEW-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_assign_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := generate_unique_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.profiles;
CREATE TRIGGER trg_assign_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION auto_assign_referral_code();

-- Populate existing profiles missing a referral_code
UPDATE public.profiles
SET referral_code = generate_unique_referral_code()
WHERE referral_code IS NULL OR referral_code = '';

-- 3. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  reward_amount_xaf INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rewarded_at TIMESTAMPTZ,
  CONSTRAINT unique_referred_user UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;
CREATE POLICY "Users can view their own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

DROP POLICY IF EXISTS "Authenticated users can insert pending referrals" ON public.referrals;
CREATE POLICY "Authenticated users can insert pending referrals"
ON public.referrals FOR INSERT
WITH CHECK (auth.uid() = referred_user_id);

DROP POLICY IF EXISTS "Admins can manage all referrals" ON public.referrals;
CREATE POLICY "Admins can manage all referrals"
ON public.referrals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Wallets Table & Columns
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  referral_balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS referral_balance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
CREATE POLICY "Users can view their own wallet"
ON public.wallets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view and update all wallets" ON public.wallets;
CREATE POLICY "Admins can view and update all wallets"
ON public.wallets FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER,
  balance_after INTEGER,
  reference TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view their own wallet transactions"
ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can manage all wallet transactions"
ON public.wallet_transactions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 6. Withdrawal Requests Table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_xaf INTEGER NOT NULL CHECK (amount_xaf >= 1000),
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'orange')),
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_admin_validation' CHECK (status IN ('pending_admin_validation', 'validated', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMPTZ,
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view their own withdrawal requests"
ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can manage all withdrawal requests"
ON public.withdrawal_requests FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 7. Stored RPCs
CREATE OR REPLACE FUNCTION get_app_setting(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
  v_val TEXT;
BEGIN
  SELECT value INTO v_val FROM public.app_settings WHERE key = p_key;
  RETURN COALESCE(v_val, '10');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_app_setting(p_key TEXT, p_value TEXT)
RETURNS JSONB AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only Ministry Administrators can update app settings.');
  END IF;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT value INTO v_percentage_str FROM public.app_settings WHERE key = 'referral_percentage';
  IF v_percentage_str IS NOT NULL AND v_percentage_str ~ '^\d+$' THEN
    v_percentage := v_percentage_str::INTEGER;
  END IF;

  v_reward_amount := ROUND((COALESCE(p_subscription_price_xaf, 500) * v_percentage) / 100.0);
  IF v_reward_amount < 50 THEN
    v_reward_amount := 50;
  END IF;

  SELECT * INTO v_referral FROM public.referrals
  WHERE referred_user_id = p_referred_user_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_pending_referral');
  END IF;

  SELECT id, referral_balance INTO v_wallet_id, v_balance_before
  FROM public.wallets WHERE user_id = v_referral.referrer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, referral_balance) VALUES (v_referral.referrer_id, 0, 0)
    RETURNING id, referral_balance INTO v_wallet_id, v_balance_before;
  END IF;

  v_balance_before := COALESCE(v_balance_before, 0);
  v_balance_after := v_balance_before + v_reward_amount;

  UPDATE public.wallets SET referral_balance = v_balance_after, updated_at = NOW() WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, v_referral.referrer_id, 'referral_credit', v_reward_amount,
    v_balance_before, v_balance_after, 'ref-' || v_referral.id,
    v_percentage || '% referral commission on subscription purchase (' || v_reward_amount || ' XAF)'
  );

  UPDATE public.referrals
  SET status = 'rewarded', rewarded_at = NOW(), reward_amount_xaf = v_reward_amount
  WHERE id = v_referral.id;

  RETURN jsonb_build_object('status', 'rewarded', 'amount', v_reward_amount, 'percentage', v_percentage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only Ministry Administrators can credit wallets.');
  END IF;

  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than 0.');
  END IF;

  SELECT id, referral_balance INTO v_wallet_id, v_ref_before
  FROM public.wallets WHERE user_id = p_target_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, referral_balance) VALUES (p_target_user_id, 0, 0)
    RETURNING id, referral_balance INTO v_wallet_id, v_ref_before;
  END IF;

  v_ref_before := COALESCE(v_ref_before, 0);
  v_ref_after := v_ref_before + p_amount_xaf;

  UPDATE public.wallets SET referral_balance = v_ref_after, updated_at = NOW() WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, p_target_user_id, 'referral_credit', p_amount_xaf,
    v_ref_before, v_ref_after, 'admin-credit-' || EXTRACT(EPOCH FROM NOW())::TEXT,
    COALESCE(p_description, 'Manual admin referral wallet credit (' || p_amount_xaf || ' XAF)')
  );

  RETURN jsonb_build_object('success', true, 'new_referral_balance', v_ref_after, 'amount', p_amount_xaf);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
