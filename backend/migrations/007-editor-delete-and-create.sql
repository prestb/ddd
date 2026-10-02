-- Complete the editor authoring boundary for monthly editions and meditations.
drop policy if exists "Editors can insert editions" on public.editions;
create policy "Editors can insert editions"
on public.editions for insert
to authenticated
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
);

drop policy if exists "Editors can delete editions" on public.editions;
create policy "Editors can delete editions"
on public.editions for delete
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
);

drop policy if exists "Editors can delete devotions" on public.devotions;
create policy "Editors can delete devotions"
on public.devotions for delete
to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('editor', 'admin'))
);
