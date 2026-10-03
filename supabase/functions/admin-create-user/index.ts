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
      return json({ error: 'FORBIDDEN', message: 'Only Ministry Administrators can create users.' }, 403);
    }

    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const requestedRole = ['reader', 'editor', 'admin'].includes(body?.role) ? body.role : 'reader';

    if (!email || !email.includes('@') || !password || password.length < 6) {
      return json({ error: 'INVALID_INPUT', message: 'Valid email and password of at least 6 characters required.' }, 400);
    }

    // 1. Create Auth user via Supabase Admin API
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError || !createdUser?.user) {
      console.error('admin-create-user: Auth creation error', createUserError);
      return json({ error: 'USER_CREATION_FAILED', message: createUserError?.message || 'Could not create user account.' }, 400);
    }

    const newUserId = createdUser.user.id;

    // 2. Set profile role
    const { error: profileError } = await admin.from('profiles').upsert({
      id: newUserId,
      role: requestedRole,
    });

    if (profileError) {
      console.error('admin-create-user: Profile upsert failed, attempting Auth user deletion', profileError);
      const { error: deleteError } = await admin.auth.admin.deleteUser(newUserId);
      if (deleteError) {
        console.error('admin-create-user: Compensation deletion failed during profile error', deleteError);
        return json({
          error: 'USER_COMPENSATION_FAILED',
          message: 'User account creation failed, and temporary account cleanup failed. Please check administrative records.',
        }, 500);
      }
      return json({ error: 'PROFILE_CREATION_FAILED', message: 'Could not create user profile.' }, 500);
    }

    // 3. Log action in admin_audit_log
    const { error: auditError } = await admin.from('admin_audit_log').insert({
      admin_user_id: adminUser.id,
      action: 'create_user',
      entity_type: 'user',
      entity_id: newUserId,
      metadata: { created_email: email, role: requestedRole },
    });

    if (auditError) {
      console.error('admin-create-user: Audit log insertion failed, attempting Auth user deletion', auditError);
      const { error: deleteError } = await admin.auth.admin.deleteUser(newUserId);
      if (deleteError) {
        console.error('admin-create-user: Compensation deletion failed during audit error', deleteError);
        return json({
          error: 'USER_COMPENSATION_FAILED',
          message: 'User creation failed due to audit constraint, and temporary account cleanup failed. Please check administrative records.',
        }, 500);
      }
      return json({ error: 'AUDIT_LOG_FAILED', message: 'User creation could not be completed because the administrative audit record could not be saved.' }, 500);
    }

    return json({
      success: true,
      user: {
        id: newUserId,
        email,
        role: requestedRole,
        created_at: createdUser.user.created_at,
      },
    });
  } catch (error) {
    console.error('admin-create-user unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'User creation failed.' }, 500);
  }
});
