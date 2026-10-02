-- Dashboard data for dated meditations, usage analytics, and newsletter drafts.
alter table public.devotions add column if not exists devotion_date date;

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.app_events enable row level security;
drop policy if exists "Users can record app events" on public.app_events;
create policy "Users can record app events" on public.app_events
  for insert with check (user_id is null or auth.uid() = user_id);
drop policy if exists "Editors can read app events" on public.app_events;
create policy "Editors can read app events" on public.app_events
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin')));

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.newsletter_campaigns enable row level security;
drop policy if exists "Editors manage newsletter campaigns" on public.newsletter_campaigns;
create policy "Editors manage newsletter campaigns" on public.newsletter_campaigns
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin')));
