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

-- Exception-safe auto-create profiles and wallets on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger error from blocking user creation in auth.users
  END;

  BEGIN
    INSERT INTO public.wallets (user_id, balance, referral_balance)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger error from blocking user creation in auth.users
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing users in auth.users missing from public.profiles and public.wallets
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET referral_code = generate_unique_referral_code()
WHERE referral_code IS NULL OR referral_code = '';

-- 3. Subscription Plans, Subscriptions & Transactions Tables
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  price_xaf INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely re-link subscriptions referencing duplicate plans before deduplication
DO $$
DECLARE
  v_monthly_id UUID;
  v_annual_id UUID;
BEGIN
  -- Find or insert single canonical Monthly plan
  SELECT id INTO v_monthly_id FROM public.subscription_plans WHERE name ILIKE 'Monthly' ORDER BY created_at DESC LIMIT 1;
  IF v_monthly_id IS NULL THEN
    INSERT INTO public.subscription_plans (name, duration_days, price_xaf, is_active)
    VALUES ('Monthly', 30, 500, true) RETURNING id INTO v_monthly_id;
  END IF;

  -- Find or insert single canonical Annual plan
  SELECT id INTO v_annual_id FROM public.subscription_plans WHERE name ILIKE 'Annual' ORDER BY created_at DESC LIMIT 1;
  IF v_annual_id IS NULL THEN
    INSERT INTO public.subscription_plans (name, duration_days, price_xaf, is_active)
    VALUES ('Annual', 365, 5000, true) RETURNING id INTO v_annual_id;
  END IF;

  -- Update any subscriptions pointing to duplicate Monthly/Annual plan IDs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    UPDATE public.subscriptions SET plan_id = v_monthly_id
    WHERE plan_id IN (SELECT id FROM public.subscription_plans WHERE name ILIKE 'Monthly' AND id <> v_monthly_id);

    UPDATE public.subscriptions SET plan_id = v_annual_id
    WHERE plan_id IN (SELECT id FROM public.subscription_plans WHERE name ILIKE 'Annual' AND id <> v_annual_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_transactions') THEN
    UPDATE public.subscription_transactions SET plan_id = v_monthly_id
    WHERE plan_id IN (SELECT id FROM public.subscription_plans WHERE name ILIKE 'Monthly' AND id <> v_monthly_id);

    UPDATE public.subscription_transactions SET plan_id = v_annual_id
    WHERE plan_id IN (SELECT id FROM public.subscription_plans WHERE name ILIKE 'Annual' AND id <> v_annual_id);
  END IF;

  -- Now safely delete orphaned duplicate plan rows
  DELETE FROM public.subscription_plans
  WHERE id NOT IN (v_monthly_id, v_annual_id) AND name ILIKE 'Monthly';

  DELETE FROM public.subscription_plans
  WHERE id NOT IN (v_monthly_id, v_annual_id) AND name ILIKE 'Annual';
END $$;

ALTER TABLE public.subscription_plans
DROP CONSTRAINT IF EXISTS unique_subscription_plan_name;

ALTER TABLE public.subscription_plans
ADD CONSTRAINT unique_subscription_plan_name UNIQUE (name);

INSERT INTO public.subscription_plans (name, duration_days, price_xaf, is_active)
VALUES
  ('Monthly', 30, 500, true),
  ('Annual', 365, 5000, true)
ON CONFLICT (name) DO UPDATE SET
  duration_days = EXCLUDED.duration_days,
  price_xaf = EXCLUDED.price_xaf,
  is_active = true;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read subscription plans" ON public.subscription_plans;
CREATE POLICY "Public can read subscription plans" ON public.subscription_plans FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id),
  type TEXT NOT NULL DEFAULT 'purchase',
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  wallet_transaction_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own subscription transactions" ON public.subscription_transactions;
CREATE POLICY "Users can view their own subscription transactions" ON public.subscription_transactions FOR SELECT USING (auth.uid() = user_id);

-- 4. Referrals Table
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

-- 5. Wallets Table & Columns
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  referral_balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallets
ADD COLUMN IF NOT EXISTS referral_balance INTEGER NOT NULL DEFAULT 0;

INSERT INTO public.wallets (user_id, balance, referral_balance)
SELECT id, 0, 0
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

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

-- 6. Wallet Transactions Table & Type Check Constraint
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

-- Drop old check constraint
ALTER TABLE public.wallet_transactions
DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- Normalize any legacy or unrecognized transaction types in existing rows to 'deposit'
UPDATE public.wallet_transactions
SET type = 'deposit'
WHERE type IS NULL OR LOWER(type) NOT IN (
  'deposit',
  'credit',
  'debit',
  'subscription_payment',
  'donation',
  'refund',
  'referral_credit',
  'transfer_to_deposit',
  'withdrawal_request',
  'withdrawal_declined_refund'
);

-- Add updated check constraint allowing all valid transaction types
ALTER TABLE public.wallet_transactions
ADD CONSTRAINT wallet_transactions_type_check
CHECK (LOWER(type) IN (
  'deposit',
  'credit',
  'debit',
  'subscription_payment',
  'donation',
  'refund',
  'referral_credit',
  'transfer_to_deposit',
  'withdrawal_request',
  'withdrawal_declined_refund'
));

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

-- 7. Withdrawal Requests Table
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

-- 8. Stored RPCs
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

-- Drop any legacy overloaded versions of debit_wallet & purchase_subscription to eliminate PostgreSQL ambiguity
DROP FUNCTION IF EXISTS public.debit_wallet CASCADE;

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id UUID,
  p_amount INTEGER,
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Wallet debit amount must be greater than zero.';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_balance_before
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, referral_balance) VALUES (p_user_id, 0, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance_before;
  END IF;

  v_balance_before := COALESCE(v_balance_before, 0);

  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Balance (% XAF) is less than required amount (% XAF).', v_balance_before, p_amount;
  END IF;

  v_balance_after := v_balance_before - p_amount;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description, metadata
  ) VALUES (
    v_wallet_id, p_user_id, 'debit', p_amount, v_balance_before, v_balance_after,
    p_reference, COALESCE(p_description, 'Account balance debit'), COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_tx_id;

  UPDATE public.wallets SET balance = v_balance_after, updated_at = NOW() WHERE id = v_wallet_id;

  RETURN jsonb_build_object(
    'wallet_id', v_wallet_id,
    'transaction_id', v_tx_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'amount', p_amount
  );
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
  -- Auto-ensure profile exists
  INSERT INTO public.profiles (id)
  VALUES (p_referred_user_id)
  ON CONFLICT (id) DO NOTHING;

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

DROP FUNCTION IF EXISTS public.purchase_subscription CASCADE;
DROP FUNCTION IF EXISTS public.debit_wallet CASCADE;

CREATE OR REPLACE FUNCTION public.purchase_subscription(
  p_user_id UUID,
  p_plan_id UUID DEFAULT NULL,
  p_plan_name TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID := p_plan_id;
  v_plan_name TEXT;
  v_duration_days INTEGER;
  v_price_xaf INTEGER;
  v_is_active BOOLEAN;
  v_wallet_id UUID;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_debit_result JSONB;
  v_wallet_tx_id UUID;
  v_subscription_id UUID;
  v_current_expires_at TIMESTAMPTZ;
  v_starts_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_sub_tx_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required for subscription purchase.';
  END IF;

  -- Auto-ensure profile exists
  INSERT INTO public.profiles (id) VALUES (p_user_id) ON CONFLICT (id) DO NOTHING;

  -- Ensure default plans exist in subscription_plans
  INSERT INTO public.subscription_plans (name, duration_days, price_xaf, is_active)
  VALUES ('Monthly', 30, 500, true), ('Annual', 365, 5000, true)
  ON CONFLICT DO NOTHING;

  -- Lookup plan by ID or Name
  IF v_plan_id IS NOT NULL THEN
    SELECT id, name, duration_days, price_xaf, is_active
    INTO v_plan_id, v_plan_name, v_duration_days, v_price_xaf, v_is_active
    FROM public.subscription_plans WHERE id = v_plan_id;
  END IF;

  IF v_plan_name IS NULL AND p_plan_name IS NOT NULL THEN
    SELECT id, name, duration_days, price_xaf, is_active
    INTO v_plan_id, v_plan_name, v_duration_days, v_price_xaf, v_is_active
    FROM public.subscription_plans WHERE name ILIKE p_plan_name AND is_active = true LIMIT 1;
  END IF;

  -- Fallback to Annual if plan still not found
  IF v_plan_name IS NULL THEN
    SELECT id, name, duration_days, price_xaf, is_active
    INTO v_plan_id, v_plan_name, v_duration_days, v_price_xaf, v_is_active
    FROM public.subscription_plans WHERE name ILIKE 'Annual' LIMIT 1;
  END IF;

  IF v_plan_name IS NULL THEN
    RAISE EXCEPTION 'Selected subscription plan is invalid or inactive.';
  END IF;

  -- Auto-ensure wallet exists
  SELECT id, balance INTO v_wallet_id, v_balance_before
  FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, referral_balance) VALUES (p_user_id, 0, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance_before;
  END IF;

  v_balance_before := COALESCE(v_balance_before, 0);

  IF v_balance_before < v_price_xaf THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Wallet balance (% XAF) is less than plan price (% XAF).', v_balance_before, v_price_xaf;
  END IF;

  -- Debit wallet
  v_debit_result := public.debit_wallet(
    p_user_id := p_user_id,
    p_amount := v_price_xaf,
    p_reference := COALESCE(p_idempotency_key, 'sub-purchase-' || gen_random_uuid()::text),
    p_description := 'Daily Dew ' || v_plan_name || ' Membership Purchase',
    p_metadata := jsonb_build_object('plan_id', v_plan_id, 'plan_name', v_plan_name)
  );

  v_wallet_tx_id := (v_debit_result->>'transaction_id')::uuid;
  v_balance_after := (v_debit_result->>'balance_after')::integer;

  -- Lock existing subscription
  SELECT id, expires_at INTO v_subscription_id, v_current_expires_at
  FROM public.subscriptions WHERE user_id = p_user_id FOR UPDATE;

  v_starts_at := NOW();
  v_expires_at := GREATEST(COALESCE(v_current_expires_at, NOW()), NOW()) + (v_duration_days || ' days')::interval;

  -- Upsert subscription
  INSERT INTO public.subscriptions (
    user_id, plan_id, status, started_at, expires_at, auto_renew, updated_at
  ) VALUES (
    p_user_id, v_plan_id, 'active', v_starts_at, v_expires_at, true, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;

  -- Record transaction
  INSERT INTO public.subscription_transactions (
    subscription_id, user_id, plan_id, type, amount, currency, wallet_transaction_id, metadata
  ) VALUES (
    v_subscription_id, p_user_id, v_plan_id, 'purchase', v_price_xaf, 'XAF', v_wallet_tx_id,
    jsonb_build_object('idempotency_key', p_idempotency_key, 'plan_name', v_plan_name)
  ) RETURNING id INTO v_sub_tx_id;

  -- Fulfill referral reward
  PERFORM fulfill_referral_reward(p_user_id, v_price_xaf);

  RETURN jsonb_build_object(
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.purchase_subscription(UUID, UUID, TEXT) TO service_role, postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role, postgres, authenticated;

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

  -- Auto-ensure profile exists
  INSERT INTO public.profiles (id)
  VALUES (p_user_id)
  ON CONFLICT (id) DO NOTHING;

  SELECT id, balance, referral_balance INTO v_wallet_id, v_dep_before, v_ref_before
  FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, referral_balance) VALUES (p_user_id, 0, 0)
    RETURNING id, balance, referral_balance INTO v_wallet_id, v_dep_before, v_ref_before;
  END IF;

  v_ref_before := COALESCE(v_ref_before, 0);
  v_dep_before := COALESCE(v_dep_before, 0);

  IF v_ref_before < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient referral wallet balance.');
  END IF;

  v_ref_after := v_ref_before - p_amount_xaf;
  v_dep_after := v_dep_before + p_amount_xaf;

  UPDATE public.wallets
  SET referral_balance = v_ref_after, balance = v_dep_after, updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, p_user_id, 'transfer_to_deposit', p_amount_xaf,
    v_ref_before, v_ref_after, 'trf-' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'Transfer from referral wallet to account balance (' || p_amount_xaf || ' XAF)'
  );

  RETURN jsonb_build_object(
    'success', true,
    'transferred', p_amount_xaf,
    'deposit_balance', v_dep_after,
    'referral_balance', v_ref_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

  IF LOWER(p_provider) NOT IN ('mtn', 'orange') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payout provider. Must be MTN or Orange.');
  END IF;

  -- Auto-ensure profile exists to prevent foreign key violation
  INSERT INTO public.profiles (id)
  VALUES (p_user_id)
  ON CONFLICT (id) DO NOTHING;

  SELECT created_at INTO v_last_request
  FROM public.withdrawal_requests
  WHERE user_id = p_user_id AND created_at > (NOW() - INTERVAL '7 days')
  ORDER BY created_at DESC LIMIT 1;

  IF v_last_request IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Withdrawals are limited to once per week. You can request another withdrawal after 7 days.'
    );
  END IF;

  SELECT id, referral_balance INTO v_wallet_id, v_ref_before
  FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, referral_balance) VALUES (p_user_id, 0, 0)
    RETURNING id, referral_balance INTO v_wallet_id, v_ref_before;
  END IF;

  v_ref_before := COALESCE(v_ref_before, 0);

  IF v_ref_before < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient referral wallet balance for withdrawal.');
  END IF;

  v_ref_after := v_ref_before - p_amount_xaf;

  -- Hold funds in escrow by deducting from referral balance
  UPDATE public.wallets SET referral_balance = v_ref_after, updated_at = NOW() WHERE id = v_wallet_id;

  -- Create pending withdrawal request
  INSERT INTO public.withdrawal_requests (
    user_id, amount_xaf, provider, phone, status
  ) VALUES (
    p_user_id, p_amount_xaf, LOWER(p_provider), p_phone, 'pending_admin_validation'
  ) RETURNING id INTO v_request_id;

  -- Log pending transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
  ) VALUES (
    v_wallet_id, p_user_id, 'withdrawal_request', p_amount_xaf,
    v_ref_before, v_ref_after, 'wd-' || v_request_id::TEXT,
    'Withdrawal request via ' || UPPER(p_provider) || ' (' || p_amount_xaf || ' XAF to ' || p_phone || ') - Pending Admin Validation'
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount', p_amount_xaf,
    'remaining_referral_balance', v_ref_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only Ministry Administrators can validate payouts.');
  END IF;

  SELECT * INTO v_request FROM public.withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found.');
  END IF;

  IF v_request.status <> 'pending_admin_validation' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request has already been processed.');
  END IF;

  IF p_action = 'validate' THEN
    UPDATE public.withdrawal_requests
    SET status = 'validated', validated_at = NOW(), admin_notes = COALESCE(p_admin_notes, 'Payout validated by admin')
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'validated');

  ELSIF p_action = 'decline' THEN
    -- Refund held amount back to user referral_balance
    SELECT id, referral_balance INTO v_wallet_id, v_ref_before
    FROM public.wallets WHERE user_id = v_request.user_id FOR UPDATE;

    v_ref_before := COALESCE(v_ref_before, 0);
    v_ref_after := v_ref_before + v_request.amount_xaf;

    UPDATE public.wallets SET referral_balance = v_ref_after, updated_at = NOW() WHERE id = v_wallet_id;

    UPDATE public.withdrawal_requests
    SET status = 'declined', validated_at = NOW(), admin_notes = COALESCE(p_admin_notes, 'Declined by admin')
    WHERE id = p_request_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, balance_before, balance_after, reference, description
    ) VALUES (
      v_wallet_id, v_request.user_id, 'withdrawal_declined_refund', v_request.amount_xaf,
      v_ref_before, v_ref_after, 'wd-ref-' || v_request.id::TEXT,
      'Refund for declined withdrawal request (' || v_request.amount_xaf || ' XAF)'
    );

    RETURN jsonb_build_object('success', true, 'status', 'declined', 'refunded', v_request.amount_xaf);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Must be validate or decline.');
  END IF;
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

  -- Auto-ensure target profile exists
  INSERT INTO public.profiles (id)
  VALUES (p_target_user_id)
  ON CONFLICT (id) DO NOTHING;

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

CREATE OR REPLACE FUNCTION admin_delete_user_account(p_target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized. Only Ministry Administrators can delete user accounts.');
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot delete your own admin account.');
  END IF;

  DELETE FROM public.wallets WHERE user_id = p_target_user_id;
  DELETE FROM public.subscriptions WHERE user_id = p_target_user_id;
  DELETE FROM public.referrals WHERE referrer_id = p_target_user_id OR referred_user_id = p_target_user_id;
  DELETE FROM public.withdrawal_requests WHERE user_id = p_target_user_id;
  DELETE FROM public.wallet_transactions WHERE user_id = p_target_user_id;
  DELETE FROM public.profiles WHERE id = p_target_user_id;

  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'deleted_user_id', p_target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
