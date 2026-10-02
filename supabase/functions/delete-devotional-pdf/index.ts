// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) throw new Error('Sign in is required.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const authClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) throw new Error('Sign in is required.');
    const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['admin', 'editor'].includes(profile.role)) throw new Error('Editor access is required.');
    const { importId } = await request.json();
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: job, error: jobError } = await admin.from('devotional_imports').select('id, owner_id, storage_path').eq('id', importId).single();
    if (jobError || !job) throw jobError ?? new Error('Import job not found.');
    if (job.owner_id !== user.id && profile.role !== 'admin') throw new Error('You can only delete your own imports.');
    const { error: storageError } = await admin.storage.from('devotional-imports').remove([job.storage_path]);
    if (storageError) throw storageError;
    const { error: deleteError } = await admin.from('devotional_imports').delete().eq('id', job.id);
    if (deleteError) throw deleteError;
    return new Response(JSON.stringify({ deleted: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'PDF could not be deleted.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }); }
});
