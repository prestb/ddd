-- Production newsletter recipients, delivery tracking, and analytics indexes.
create table if not exists public.newsletter_subscribers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  opted_in boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
drop policy if exists "Users manage their newsletter preference" on public.newsletter_subscribers;
create policy "Users manage their newsletter preference" on public.newsletter_subscribers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Editors read newsletter subscribers" on public.newsletter_subscribers;
create policy "Editors read newsletter subscribers" on public.newsletter_subscribers
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin')));

alter table public.newsletter_campaigns add column if not exists audience_count integer not null default 0;
alter table public.newsletter_campaigns add column if not exists provider_message_id text;
alter table public.newsletter_campaigns add column if not exists error_message text;

create table if not exists public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers(user_id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);
alter table public.newsletter_deliveries enable row level security;
drop policy if exists "Editors manage newsletter deliveries" on public.newsletter_deliveries;
create policy "Editors manage newsletter deliveries" on public.newsletter_deliveries
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin')));

create index if not exists app_events_type_created_at_idx on public.app_events(event_type, created_at desc);
create index if not exists newsletter_deliveries_campaign_idx on public.newsletter_deliveries(campaign_id, status);
