// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-wh-secret' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const secret = Deno.env.get('FAPSHI_WEBHOOK_SECRET');
    if (secret && request.headers.get('x-wh-secret') !== secret) return new Response('Unauthorized', { status: 401, headers: cors });
    const payload = await request.json();
    const statusMap = { SUCCESSFUL: 'successful', FAILED: 'failed', EXPIRED: 'cancelled' };
    const status = statusMap[payload?.status];
    if (!status || !payload?.transId) return new Response(JSON.stringify({ received: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.from('donations').update({ status, updated_at: new Date().toISOString() }).eq('transaction_id', payload.transId);
    if (error) throw error;
    return new Response(JSON.stringify({ received: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
