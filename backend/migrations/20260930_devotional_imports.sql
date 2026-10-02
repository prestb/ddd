insert into storage.buckets (id, name, public)
values ('devotional-imports', 'devotional-imports', false)
on conflict (id) do nothing;

create policy "Editors can upload devotional imports"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'devotional-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'editor'))
);

create policy "Editors can view devotional imports"
on storage.objects for select
to authenticated
using (
  bucket_id = 'devotional-imports'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'editor'))
);
