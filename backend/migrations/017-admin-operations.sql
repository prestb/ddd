-- UX-11 ADMIN OPERATIONS: Append-only Admin Audit Log Table
-- Tracks administrative actions (user creation, role modifications, financial reviews) performed by Ministry Admins.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text default null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS Policies for admin_audit_log
alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins can read admin audit log" on public.admin_audit_log;
create policy "Admins can read admin audit log" on public.admin_audit_log
  for select using (
    auth.uid() in (select id from public.profiles where role = 'admin')
  );

grant select on public.admin_audit_log to authenticated, service_role;
