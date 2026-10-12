// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Read request: GET or POST with action 'get'
    if (request.method === 'GET') {
      const { data: settingsRows } = await admin.from('app_settings').select('key, value, description, updated_at');
      const settingsMap: Record<string, string> = {};
      (settingsRows ?? []).forEach((row) => {
        settingsMap[row.key] = row.value;
      });
      return json({ success: true, settings: settingsMap, rows: settingsRows ?? [] });
    }

    // Write request: POST with Authorization header & Admin check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'UNAUTHORIZED', message: 'Authentication required.' }, 401);
    }

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: adminUser }, error: authError } = await authClient.auth.getUser();

    if (authError || !adminUser) {
      return json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session.' }, 401);
    }

    const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', adminUser.id).maybeSingle();
    if (adminProfile?.role !== 'admin') {
      return json({ error: 'FORBIDDEN', message: 'Only Ministry Administrators can update app settings.' }, 403);
    }

    const body = await request.json();
    const { key, value } = body ?? {};

    if (!key || value === undefined) {
      return json({ error: 'INVALID_INPUT', message: 'Setting key and value are required.' }, 400);
    }

    const { error: upsertError } = await admin
      .from('app_settings')
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() });

    if (upsertError) {
      console.error('admin-app-settings upsert error', upsertError);
      return json({ error: 'UPSERT_FAILED', message: 'Failed to update setting.' }, 500);
    }

    return json({
      success: true,
      key,
      value: String(value),
    });
  } catch (error) {
    console.error('admin-app-settings unhandled exception', error);
    return json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Could not update app settings right now.',
      },
      500
    );
  }
});
