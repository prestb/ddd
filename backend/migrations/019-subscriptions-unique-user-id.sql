-- UX-12 FIX: Unique Constraint on public.subscriptions(user_id)
-- Required for ON CONFLICT (user_id) upsert support in purchase_subscription() RPC.

-- 1. Deduplicate any existing duplicate subscription rows if present, keeping the latest expires_at
delete from public.subscriptions s1
using public.subscriptions s2
where s1.user_id = s2.user_id
  and s1.id != s2.id
  and s1.created_at < s2.created_at;

-- 2. Drop legacy non-unique index if present
drop index if exists public.subscriptions_user_id_idx;

-- 3. Create authoritative UNIQUE index on public.subscriptions(user_id)
create unique index if not exists subscriptions_user_id_unique_idx
  on public.subscriptions (user_id);

-- 4. Add table unique constraint for PostgREST / ON CONFLICT compatibility
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_user_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_user_id_key unique using index subscriptions_user_id_unique_idx;
  end if;
exception
  when others then null;
end $$;
