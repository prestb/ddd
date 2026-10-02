-- Daily Dew content and user memory schema.
-- Run this only in a new backend project after reviewing ministry permissions.

create table public.editions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  theme text not null,
  month integer not null check (month between 1 and 12),
  year integer not null,
  language text not null default 'en' check (language in ('en', 'fr')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  introduction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devotions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 31),
  devotion_date date,
  weekday text not null,
  title text not null,
  scripture_reference text not null,
  scripture_text text,
  meditation text not null,
  further_studies jsonb not null default '[]'::jsonb,
  wisdom_nugget text,
  declaration text,
  created_at timestamptz not null default now(),
  unique (edition_id, day_number)
);

create table public.prayer_points (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions(id) on delete cascade,
  category text not null,
  position integer not null,
  prayer text not null
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  language text not null default 'en' check (language in ('en', 'fr')),
  font_scale numeric not null default 1.0 check (font_scale between 0.9 and 1.2),
  created_at timestamptz not null default now()
);

create table public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  devotion_id uuid not null references public.devotions(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, devotion_id)
);

create table public.journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  devotion_id uuid not null references public.devotions(id) on delete cascade,
  reflection text not null default '',
  prayer text not null default '',
  answered_prayer boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, devotion_id)
);

create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  devotion_id uuid not null references public.devotions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, devotion_id)
);

create table public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.journal_entries enable row level security;
alter table public.bookmarks enable row level security;
alter table public.app_events enable row level security;
alter table public.newsletter_campaigns enable row level security;

create policy "Users manage their profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage their progress" on public.user_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their journal" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their bookmarks" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can record app events" on public.app_events
  for insert with check (user_id is null or auth.uid() = user_id);

-- Published content is public to the app. Draft and review editions remain private.
alter table public.editions enable row level security;
alter table public.devotions enable row level security;
alter table public.prayer_points enable row level security;

create policy "Anyone can read published editions" on public.editions
  for select using (status = 'published');

create policy "Anyone can read published devotions" on public.devotions
  for select using (
    exists (select 1 from public.editions e where e.id = edition_id and e.status = 'published')
  );

create policy "Anyone can read published prayer points" on public.prayer_points
  for select using (
    exists (select 1 from public.editions e where e.id = edition_id and e.status = 'published')
  );
