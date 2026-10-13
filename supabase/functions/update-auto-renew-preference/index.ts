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
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return json({ error: 'UNAUTHORIZED', message: 'Invalid or expired user session.' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body?.autoRenew !== 'boolean') {
      return json({ error: 'INVALID_INPUT', message: 'autoRenew boolean field is required.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Update auto-renew preference via service-role client RPC
    const { data: result, error: rpcError } = await admin.rpc('update_auto_renew_preference', {
      p_user_id: user.id,
      p_auto_renew: body.autoRenew,
    });

    if (rpcError) {
      console.error('update-auto-renew-preference: RPC execution failed', rpcError);
      return json({ error: 'UPDATE_FAILED', message: 'Could not update auto-renewal preference.' }, 500);
    }

    return json({
      success: true,
      autoRenew: body.autoRenew,
      result,
    });
  } catch (error) {
    console.error('update-auto-renew-preference unhandled exception', error);
    return json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Could not update auto-renewal preference right now.',
      },
      500
    );
  }
});
