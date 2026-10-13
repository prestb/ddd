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

    // Verify caller is authorized (Ministry Admin by email or admin/editor profile role)
    const ministryAdminEmail = Deno.env.get('EXPO_PUBLIC_MINISTRY_ADMIN_EMAIL')?.toLowerCase();
    const isMinistryAdminByEmail = Boolean(ministryAdminEmail && adminUser.email?.toLowerCase() === ministryAdminEmail);

    const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', adminUser.id).maybeSingle();
    const isAuthorized = isMinistryAdminByEmail || ['admin', 'editor'].includes(adminProfile?.role ?? '');

    if (!isAuthorized) {
      return json({ error: 'FORBIDDEN', message: 'Only Ministry Administrators and Editors can view user accounts.' }, 403);
    }

    // Auto-heal admin role for primary ministry admin by email if missing
    if (isMinistryAdminByEmail && adminProfile?.role !== 'admin') {
      await admin.from('profiles').upsert({ id: adminUser.id, role: 'admin' });
    }

    // 1. Fetch profiles
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, role, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('admin-users: Profiles query error', profilesError);
      return json({ error: 'DATABASE_ERROR', message: 'Could not retrieve user profiles.' }, 500);
    }

    // 2. Fetch all Auth users via Admin API using paginated requests (fail-closed)
    const authUsersMap = new Map<string, any>();
    let page = 1;
    const perPage = 1000;
    let hasMoreAuthUsers = true;

    try {
      while (hasMoreAuthUsers) {
        const { data: authUsersData, error: authUsersError } = await admin.auth.admin.listUsers({ page, perPage });

        if (authUsersError) {
          console.error(`admin-users: Auth listUsers error on page ${page}`, authUsersError);
          return json({
            error: 'AUTH_USERS_FETCH_FAILED',
            message: 'Could not retrieve authentication accounts. Please try again.',
          }, 500);
        }

        const usersBatch = authUsersData?.users ?? [];
        usersBatch.forEach((u: any) => {
          authUsersMap.set(u.id, u);
        });

        if (usersBatch.length < perPage) {
          hasMoreAuthUsers = false;
        } else {
          page++;
        }
      }
    } catch (fetchErr) {
      console.error('admin-users: Exception during Auth user listing', fetchErr);
      return json({
        error: 'AUTH_USERS_FETCH_FAILED',
        message: 'Could not retrieve authentication accounts. Please try again.',
      }, 500);
    }

    // 3. Construct True Union: Auth Users ∪ Profiles
    const allUserIds = new Set<string>();
    (profiles ?? []).forEach((p) => allUserIds.add(p.id));
    authUsersMap.forEach((_, id) => allUserIds.add(id));

    const profilesMap = new Map<string, any>();
    (profiles ?? []).forEach((p) => profilesMap.set(p.id, p));

    const usersList = Array.from(allUserIds).map((id) => {
      const authU = authUsersMap.get(id);
      const profileP = profilesMap.get(id);

      const hasAuth = Boolean(authU);
      const hasProfile = Boolean(profileP);

      return {
        id,
        email: authU?.email ?? null,
        auth_account_missing: !hasAuth,
        profile_missing: !hasProfile,
        role: profileP?.role ?? (hasAuth ? 'none' : 'reader'),
        created_at: profileP?.created_at ?? authU?.created_at ?? new Date().toISOString(),
      };
    });

    return json({
      success: true,
      users: usersList,
    });
  } catch (error) {
    console.error('admin-users unhandled exception', error);
    return json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'User information could not be retrieved right now.',
      },
      500
    );
  }
});
