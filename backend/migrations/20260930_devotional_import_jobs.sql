create table if not exists public.devotional_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  source_name text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'review', 'imported', 'failed')),
  extracted_data jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.devotional_imports enable row level security;

create policy "Editors can view their devotional imports"
on public.devotional_imports for select
to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'editor')));

create policy "Editors can create devotional imports"
on public.devotional_imports for insert
to authenticated
with check (owner_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'editor')));

create policy "Editors can update their devotional imports"
on public.devotional_imports for update
to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'editor')))
with check (owner_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'editor')));
