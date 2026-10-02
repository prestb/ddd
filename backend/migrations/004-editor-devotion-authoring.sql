-- Allow ministry editors to add and revise devotional days.
drop policy if exists "Editors can insert devotions" on public.devotions;
create policy "Editors can insert devotions" on public.devotions
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
  );

drop policy if exists "Editors can update devotions" on public.devotions;
create policy "Editors can update devotions" on public.devotions
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
  );
