// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Only POST is supported.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is an administrator
    const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', adminUser.id).maybeSingle();
    if (adminProfile?.role !== 'admin') {
      return json({ error: 'FORBIDDEN', message: 'Only Ministry Administrators can list user accounts.' }, 403);
    }

    // 1. Fetch profiles
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('admin-users: Profiles query error', profilesError);
      return json({ error: 'DATABASE_ERROR', message: 'Could not retrieve user profiles.' }, 500);
    }

    // 2. Fetch Auth users via Admin API
    const { data: authUsersData, error: authUsersError } = await admin.auth.admin.listUsers();

    const authUsersMap = new Map<string, any>();
    if (!authUsersError && Array.isArray(authUsersData?.users)) {
      authUsersData.users.forEach((u: any) => {
        authUsersMap.set(u.id, u);
      });
    }

    const usersList = (profiles ?? []).map((p) => {
      const authU = authUsersMap.get(p.id);
      return {
        id: p.id,
        email: authU?.email ?? 'anonymous',
        role: p.role ?? 'reader',
        created_at: p.created_at ?? authU?.created_at ?? new Date().toISOString(),
      };
    });

    return json({
      success: true,
      users: usersList,
    });
  } catch (error) {
    console.error('admin-users unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'User listing failed.' }, 500);
  }
});
