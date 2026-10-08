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
      return json({ error: 'Authentication required to purchase subscription.' }, 401);
    }

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Invalid or expired user session.' }, 401);
    }

    const body = await request.json();
    const planId = body?.planId;
    const planNameRequested = body?.planName; // 'Monthly' | 'Annual' fallback lookup
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : null;

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Look up plan in subscription_plans (never trust client-supplied price/duration)
    let planQuery = admin.from('subscription_plans').select('id, name, duration_days, price_xaf, is_active').eq('is_active', true);
    if (planId) {
      planQuery = planQuery.eq('id', planId);
    } else if (planNameRequested) {
      planQuery = planQuery.ilike('name', planNameRequested);
    } else {
      planQuery = planQuery.ilike('name', 'Annual');
    }

    const { data: plan, error: planError } = await planQuery.maybeSingle();

    if (planError || !plan) {
      return json({ error: 'Selected subscription plan is invalid or unavailable.' }, 400);
    }

    // 2. Execute atomic purchase_subscription RPC
    const { data: purchaseResult, error: rpcError } = await admin.rpc('purchase_subscription', {
      p_user_id: user.id,
      p_plan_id: plan.id,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcError) {
      console.error('purchase-subscription: purchase_subscription RPC failed', rpcError);
      const isInsufficient = rpcError.message?.includes('INSUFFICIENT_BALANCE');
      if (isInsufficient) {
        return json(
          {
            error: 'INSUFFICIENT_BALANCE: Your account balance is less than the plan price.',
            code: 'INSUFFICIENT_BALANCE',
          },
          400
        );
      }
      return json(
        {
          error: 'SUBSCRIPTION_PURCHASE_FAILED',
          message: 'Subscription purchase failed right now.',
          code: 'PURCHASE_FAILED',
        },
        400
      );
    }

    return json({
      success: true,
      planName: plan.name,
      priceXaf: plan.price_xaf,
      durationDays: plan.duration_days,
      result: purchaseResult,
    });
  } catch (error) {
    console.error('purchase-subscription failed', error);
    return json(
      {
        error: 'SUBSCRIPTION_PURCHASE_FAILED',
        message: 'Subscription purchase failed right now.',
        code: 'PURCHASE_FAILED',
      },
      400
    );
  }
});
