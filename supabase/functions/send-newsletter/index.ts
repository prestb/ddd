// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
const newsletterHtml = (subject: string, body: string) => {
  const paragraphs = body.trim().split(/\n\s*\n/).filter(Boolean).map((paragraph) => `<p style="margin:0 0 18px;line-height:1.7;color:#526057;font-size:16px;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f5f1e9;font-family:Arial,sans-serif;color:#1f2b25;"><div style="max-width:640px;margin:0 auto;padding:28px 18px;"><div style="background:#31543f;border-radius:18px 18px 0 0;padding:25px 28px;"><div style="color:#e4b98d;font-size:12px;font-weight:700;letter-spacing:3px;">DAILY DEW</div><div style="color:#ffffff;font-family:Georgia,serif;font-size:28px;font-weight:700;margin-top:8px;">Devotional</div></div><main style="background:#ffffff;padding:34px 28px;border-radius:0 0 18px 18px;"><div style="color:#c26a3b;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:12px;">A NOTE FROM DAILY DEW</div><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2;margin:0 0 24px;color:#1f2b25;">${escapeHtml(subject)}</h1>${paragraphs}<div style="border-top:1px solid #e1d9cd;margin-top:28px;padding-top:18px;color:#899189;font-size:12px;line-height:1.6;">Daily Dew Devotional<br>Scripture, meditation, prayer, and reflection for your daily walk.</div></main></div></body></html>`;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = request.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('RESEND_FROM_EMAIL');
    if (!authHeader || !resendKey || !from) throw new Error('Newsletter delivery is not configured.');

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) throw new Error('Sign in is required.');
    const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['editor', 'admin'].includes(profile.role)) throw new Error('Editor access is required.');

    const { campaignId } = await request.json();
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: campaign, error: campaignError } = await admin.from('newsletter_campaigns').select('id, subject, body, status').eq('id', campaignId).single();
    if (campaignError || !campaign) throw campaignError ?? new Error('Campaign not found.');
    if (campaign.status === 'sent') throw new Error('This campaign has already been sent.');
    const { data: recipients, error: recipientError } = await admin.from('newsletter_subscribers').select('user_id, email').eq('opted_in', true);
    if (recipientError) throw recipientError;
    await admin.from('newsletter_campaigns').update({ status: 'scheduled', audience_count: recipients?.length ?? 0, error_message: null }).eq('id', campaign.id);

    let sent = 0;
    for (const recipient of recipients ?? []) {
      const { data: delivery } = await admin.from('newsletter_deliveries').upsert({ campaign_id: campaign.id, subscriber_id: recipient.user_id, status: 'queued' }, { onConflict: 'campaign_id,subscriber_id' }).select('id').single();
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [recipient.email], subject: campaign.subject, text: campaign.body, html: newsletterHtml(campaign.subject, campaign.body) }) });
      const result = await response.json();
      if (response.ok) {
        sent += 1;
        await admin.from('newsletter_deliveries').update({ status: 'sent', provider_message_id: result.id ?? null, sent_at: new Date().toISOString() }).eq('id', delivery?.id);
      } else {
        await admin.from('newsletter_deliveries').update({ status: 'failed', error_message: result.message ?? 'Provider rejected message' }).eq('id', delivery?.id);
      }
    }
    await admin.from('newsletter_campaigns').update({ status: sent === (recipients?.length ?? 0) ? 'sent' : 'failed', sent_at: sent ? new Date().toISOString() : null }).eq('id', campaign.id);
    return new Response(JSON.stringify({ sent, total: recipients?.length ?? 0 }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Newsletter delivery failed.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
