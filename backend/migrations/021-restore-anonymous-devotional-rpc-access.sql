-- UX-14 FIX: Restore Anonymous Execution Permission for get_published_edition_devotions RPC
-- Daily Dew permits anonymous/guest reading prior to account sign-in.
-- Server-side day-level gating inside the RPC continues to restrict anonymous callers to Free Days 1-3.

grant execute on function public.get_published_edition_devotions(text)
to anon, authenticated, service_role, postgres;
