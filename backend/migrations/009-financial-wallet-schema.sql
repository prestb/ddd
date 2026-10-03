-- UX-08B-1-CORRECTION: Financial Database & Wallet Foundation
-- Establishes the authoritative schema for subscription_plans, wallets, wallet_transactions,
-- payment_transactions, subscriptions, and subscription_transactions.
-- NON-DESTRUCTIVE DELETE BEHAVIOR: Financial history rows use ON DELETE RESTRICT / ON DELETE SET NULL
-- so user deletion never destroys historical financial records required for auditing & reconciliation.

-- 1. SUBSCRIPTION PLANS
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_days integer not null check (duration_days > 0),
  price_xaf integer not null check (price_xaf >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

drop policy if exists "Active subscription plans are public" on public.subscription_plans;
create policy "Active subscription plans are public"
  on public.subscription_plans for select
  using (is_active = true or auth.uid() in (select id from public.profiles where role in ('admin', 'editor')));

-- Seed standard V1 subscription plans
insert into public.subscription_plans (name, description, duration_days, price_xaf)
values
  ('Monthly', 'Flexible 30-day full access to Daily Dew Premium', 30, 500),
  ('Annual', 'Full 365-day annual access with 1,000 XAF savings', 365, 5000)
on conflict do nothing;

-- 2. WALLETS (One prepaid account balance container per user)
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallets_user_id_idx on public.wallets(user_id);

alter table public.wallets enable row level security;

drop policy if exists "Users can view their own wallet" on public.wallets;
create policy "Users can view their own wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

-- 3. WALLET TRANSACTIONS (Non-destructible, append-only financial ledger)
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  type text not null check (type in ('credit', 'debit')),
  amount integer not null check (amount > 0),
  balance_before integer not null check (balance_before >= 0),
  balance_after integer not null check (balance_after >= 0),
  reference text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_id_idx on public.wallet_transactions(wallet_id);
create index if not exists wallet_transactions_user_id_idx on public.wallet_transactions(user_id);
create index if not exists wallet_transactions_created_at_idx on public.wallet_transactions(created_at desc);

alter table public.wallet_transactions enable row level security;

drop policy if exists "Users can view their own wallet transactions" on public.wallet_transactions;
create policy "Users can view their own wallet transactions"
  on public.wallet_transactions for select
  using (auth.uid() = user_id);

-- 4. PAYMENT TRANSACTIONS (Provider interaction transactions)
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  purpose text not null default 'wallet_deposit' check (purpose in ('wallet_deposit', 'direct_subscription')),
  provider text not null default 'fapshi',
  provider_transaction_id text unique,
  external_reference text unique not null,
  amount integer not null check (amount > 0),
  currency text not null default 'XAF',
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_user_id_idx on public.payment_transactions(user_id);
create index if not exists payment_transactions_provider_trans_id_idx on public.payment_transactions(provider_transaction_id);
create index if not exists payment_transactions_status_idx on public.payment_transactions(status);

alter table public.payment_transactions enable row level security;

drop policy if exists "Users can view their own payment transactions" on public.payment_transactions;
create policy "Users can view their own payment transactions"
  on public.payment_transactions for select
  using (auth.uid() = user_id);

-- 5. SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- 6. SUBSCRIPTION TRANSACTIONS
create table if not exists public.subscription_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  type text not null check (type in ('purchase', 'renewal')),
  amount integer not null check (amount >= 0),
  currency text not null default 'XAF',
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_transactions_subscription_id_idx on public.subscription_transactions(subscription_id);
create index if not exists subscription_transactions_user_id_idx on public.subscription_transactions(user_id);

alter table public.subscription_transactions enable row level security;

drop policy if exists "Users can view their own subscription transactions" on public.subscription_transactions;
create policy "Users can view their own subscription transactions"
  on public.subscription_transactions for select
  using (auth.uid() = user_id);
