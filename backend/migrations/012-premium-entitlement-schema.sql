-- UX-09: Premium Entitlement & Content Access Enforcement
-- Adds access_level column to editions table and enforces server-side RLS policies for premium content.

-- 1. ADD ACCESS LEVEL COLUMN TO EDITIONS
alter table public.editions
  add column if not exists access_level text not null default 'free' check (access_level in ('free', 'premium'));

-- 2. SERVER-SIDE ENTITLEMENT HELPER FUNCTION
create or replace function public.has_active_subscription(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      and s.expires_at > now()
  );
end;
$$;

-- Grant execution to authenticated users & service_role
grant execute on function public.has_active_subscription(uuid) to authenticated, service_role, postgres;

-- 3. REVISE RLS POLICIES FOR EDITIONS AND DEVOTIONS
drop policy if exists "Anyone can read published editions" on public.editions;
drop policy if exists "Read published editions according to access_level" on public.editions;

create policy "Read published editions according to access_level" on public.editions
  for select using (
    status = 'published' and (
      access_level = 'free' or
      public.has_active_subscription(auth.uid()) or
      auth.uid() in (select id from public.profiles where role in ('admin', 'editor'))
    )
  );

drop policy if exists "Anyone can read published devotions" on public.devotions;
drop policy if exists "Read published devotions according to edition access_level" on public.devotions;

create policy "Read published devotions according to edition access_level" on public.devotions
  for select using (
    exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.status = 'published'
        and (
          e.access_level = 'free' or
          public.has_active_subscription(auth.uid()) or
          auth.uid() in (select id from public.profiles where role in ('admin', 'editor'))
        )
    )
  );
