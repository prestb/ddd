-- Add editor roles and allow editors to review and publish editions.
alter table public.profiles
  add column if not exists role text not null default 'reader'
  check (role in ('reader', 'editor', 'admin'));

drop policy if exists "Editors can read all editions" on public.editions;
create policy "Editors can read all editions" on public.editions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
    or status = 'published'
  );

drop policy if exists "Editors can update editions" on public.editions;
create policy "Editors can update editions" on public.editions
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
  );

drop policy if exists "Editors can read all devotions" on public.devotions;
create policy "Editors can read all devotions" on public.devotions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
    or exists (select 1 from public.editions e where e.id = edition_id and e.status = 'published')
  );
