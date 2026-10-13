-- UX-10 DAY-LEVEL ENTITLEMENT: Server-enforced day-level premium access
-- Free readers receive full content for Days 1-3. Day 4+ metadata is returned with is_locked = true and protected fields omitted.
-- Active Premium subscribers (and admin/editors) receive full content for all published days.

create or replace function public.get_published_edition_devotions(
  p_language text default 'en'
)
returns table (
  edition_id uuid,
  edition_slug text,
  edition_title text,
  edition_theme text,
  edition_introduction text,
  edition_month integer,
  edition_year integer,
  edition_access_level text,
  day_number integer,
  weekday text,
  title text,
  scripture_reference text,
  meditation text,
  further_studies jsonb,
  wisdom_nugget text,
  declaration text,
  is_locked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_subscribed boolean;
  v_is_admin_or_editor boolean;
  v_edition record;
begin
  v_user_id := auth.uid();

  -- Check if user has active subscription
  v_is_subscribed := public.has_active_subscription(v_user_id);

  -- Check if user is admin or editor
  if v_user_id is not null then
    select exists (
      select 1 from public.profiles p where p.id = v_user_id and p.role in ('admin', 'editor')
    ) into v_is_admin_or_editor;
  else
    v_is_admin_or_editor := false;
  end if;

  -- Select latest published edition for language (with fallback to 'en')
  select id, slug, title, theme, introduction, month, year, access_level
  into v_edition
  from public.editions
  where status = 'published' and language = p_language
  order by year desc, month desc
  limit 1;

  if v_edition.id is null and p_language != 'en' then
    select id, slug, title, theme, introduction, month, year, access_level
    into v_edition
    from public.editions
    where status = 'published' and language = 'en'
    order by year desc, month desc
    limit 1;
  end if;

  if v_edition.id is null then
    return;
  end if;

  -- Return rows with server-enforced day-level & edition-level gating
  return query
  select
    v_edition.id as edition_id,
    v_edition.slug as edition_slug,
    v_edition.title as edition_title,
    v_edition.theme as edition_theme,
    coalesce(v_edition.introduction, '') as edition_introduction,
    v_edition.month as edition_month,
    v_edition.year as edition_year,
    v_edition.access_level as edition_access_level,
    d.day_number,
    d.weekday,
    d.title,
    d.scripture_reference,
    case
      when (v_is_subscribed or v_is_admin_or_editor) then d.meditation
      when v_edition.access_level = 'premium' then ''
      when d.day_number <= 3 then d.meditation
      else ''
    end as meditation,
    case
      when (v_is_subscribed or v_is_admin_or_editor) then d.further_studies
      when v_edition.access_level = 'premium' then '[]'::jsonb
      when d.day_number <= 3 then d.further_studies
      else '[]'::jsonb
    end as further_studies,
    case
      when (v_is_subscribed or v_is_admin_or_editor) then coalesce(d.wisdom_nugget, '')
      when v_edition.access_level = 'premium' then ''
      when d.day_number <= 3 then coalesce(d.wisdom_nugget, '')
      else ''
    end as wisdom_nugget,
    case
      when (v_is_subscribed or v_is_admin_or_editor) then coalesce(d.declaration, '')
      when v_edition.access_level = 'premium' then ''
      when d.day_number <= 3 then coalesce(d.declaration, '')
      else ''
    end as declaration,
    case
      when (v_is_subscribed or v_is_admin_or_editor) then false
      when v_edition.access_level = 'premium' then true
      when d.day_number <= 3 then false
      else true
    end as is_locked
  from public.devotions d
  where d.edition_id = v_edition.id
  order by d.day_number asc;
end;
$$;

grant execute on function public.get_published_edition_devotions(text) to anon, authenticated, service_role, postgres;
