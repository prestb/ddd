-- Apply after supabase-schema.sql to sync answered prayer status across devices.
alter table public.journal_entries
  add column if not exists answered_prayer boolean not null default false;
