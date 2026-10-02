create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  external_id text unique not null,
  transaction_id text,
  amount integer not null check (amount >= 100),
  currency text not null default 'XAF',
  provider text not null default 'fapshi',
  status text not null default 'pending' check (status in ('pending', 'successful', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donations_user_id_idx on public.donations(user_id);
create index if not exists donations_transaction_id_idx on public.donations(transaction_id);

alter table public.donations enable row level security;

drop policy if exists "Users can view their donations" on public.donations;
create policy "Users can view their donations"
  on public.donations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their donations" on public.donations;
create policy "Users can create their donations"
  on public.donations for insert
  with check (auth.uid() = user_id);
