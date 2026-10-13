-- UX-10 FINAL SURGICAL FIX: Adds metadata jsonb column to public.donations table
-- Allows create-donation and check-donation-status to safely persist verification_token and provider response data.

alter table public.donations
  add column if not exists metadata jsonb not null default '{}'::jsonb;
