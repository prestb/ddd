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
      return json({ error: 'FORBIDDEN', message: 'Only Ministry Administrators can update user roles.' }, 403);
    }

    const body = await request.json();
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const newRole = ['reader', 'editor', 'admin'].includes(body?.newRole) ? body.newRole : null;

    if (!targetUserId || !newRole) {
      return json({ error: 'INVALID_INPUT', message: 'Target user ID and valid role required.' }, 400);
    }

    // Prevent self-demotion if caller is demoting themselves
    if (targetUserId === adminUser.id && newRole !== 'admin') {
      return json({ error: 'SELF_DEMOTION_BLOCKED', message: 'You cannot remove your own administrator privileges.' }, 400);
    }

    // Update profile role
    const { error: updateError } = await admin
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('admin-update-user-role: Update error', updateError);
      return json({ error: 'ROLE_UPDATE_FAILED', message: updateError.message }, 500);
    }

    // Log action in admin_audit_log
    await admin.from('admin_audit_log').insert({
      admin_user_id: adminUser.id,
      action: 'update_user_role',
      entity_type: 'user',
      entity_id: targetUserId,
      metadata: { new_role: newRole },
    });

    return json({
      success: true,
      targetUserId,
      newRole,
    });
  } catch (error) {
    console.error('admin-update-user-role unhandled exception', error);
    return json({ error: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Role update failed.' }, 500);
  }
});
