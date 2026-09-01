import type { APIRoute } from 'astro';
import { id, now } from '../../../lib/security';
import { verifyPaypalWebhook } from '../../../services/paypal';

type PaypalEvent = {
  id?: string;
  event_type?: string;
  resource?: { id?: string; custom_id?: string; status?: string; billing_info?: { next_billing_time?: string } };
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  let event: PaypalEvent;
  try {
    event = await request.json() as PaypalEvent;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  try {
    if (!event.id || !event.event_type || !await verifyPaypalWebhook(request, event, env)) return new Response('Unauthorized', { status: 401 });
    const existing = await env.DB.prepare('SELECT id FROM paypal_events WHERE event_id = ?').bind(event.id).first();
    if (existing) return new Response(null, { status: 200 });

    const statements = [env.DB.prepare('INSERT INTO paypal_events (id, event_id, event_type, payload_json, processed_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id(), event.id, event.event_type, JSON.stringify(event), now())];
    const resource = event.resource;
    const userId = resource?.custom_id;
    const subscriptionId = resource?.id;
    if (resource && userId && subscriptionId) {
      statements.push(env.DB.prepare('UPDATE subscriptions SET paypal_subscription_id = ?, status = ?, next_billing_at = ?, updated_at = ? WHERE user_id = ?')
        .bind(subscriptionId, resource.status?.toLowerCase() ?? 'unknown', resource.billing_info?.next_billing_time ?? null, now(), userId));
    }
    await env.DB.batch(statements);
    return new Response(null, { status: 200 });
  } catch {
    const duplicate = event.id && await env.DB.prepare('SELECT id FROM paypal_events WHERE event_id = ?').bind(event.id).first();
    return duplicate ? new Response(null, { status: 200 }) : new Response('Webhook processing failed', { status: 502 });
  }
};
