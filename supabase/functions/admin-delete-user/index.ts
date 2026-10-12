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
      return json({ error: 'FORBIDDEN', message: 'Only Ministry Administrators can delete users.' }, 403);
    }

    const body = await request.json();
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';

    if (!targetUserId) {
      return json({ error: 'INVALID_INPUT', message: 'Target user ID is required.' }, 400);
    }

    // Prevent self-deletion
    if (targetUserId === adminUser.id) {
      return json({ error: 'SELF_DELETION_BLOCKED', message: 'You cannot delete your own administrator account.' }, 400);
    }

    // 1. Delete user from database tables first
    await admin.from('profiles').delete().eq('id', targetUserId);
    await admin.from('wallets').delete().eq('user_id', targetUserId);
    await admin.from('subscriptions').delete().eq('user_id', targetUserId);

    // 2. Delete user from Supabase Auth Admin API (works even for auth-only users!)
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
      console.error('admin-delete-user: Auth deletion error', deleteAuthError);
    }

    // 3. Log action in admin_audit_log
    await admin.from('admin_audit_log').insert({
      admin_user_id: adminUser.id,
      action: 'delete_user',
      entity_type: 'user',
      entity_id: targetUserId,
      metadata: { deleted_user_id: targetUserId },
    });

    return json({
      success: true,
      targetUserId,
    });
  } catch (error) {
    console.error('admin-delete-user unhandled exception', error);
    return json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Could not delete the user account right now.',
      },
      500
    );
  }
});
