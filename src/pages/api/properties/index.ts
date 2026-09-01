import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/auth';
import { assertSameOrigin, assertString, body, errorResponse, json } from '../../../lib/http';
import { id, now } from '../../../lib/security';
import { verifyGa4Property } from '../../../services/google-analytics';
import { planLimits } from '../../../services/plan-limits';

type PropertyRow = { id: string; ga4_property_id: string; display_name: string; status: string; created_at: string };

export const GET: APIRoute = async ({ request, locals }) => {
  const user = await requireUser(request, locals.runtime.env);
  if (!user) return json({ error: 'Authentication required' }, 401);
  const result = await locals.runtime.env.DB.prepare('SELECT id, ga4_property_id, display_name, status, created_at FROM properties WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC').bind(user.id).all<PropertyRow>();
  return json({ properties: result.results });
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    assertSameOrigin(request, env.APP_URL);
    const user = await requireUser(request, env);
    if (!user) return json({ error: 'Authentication required' }, 401);
    const input = await body<{ propertyName: unknown }>(request);
    const propertyName = assertString(input.propertyName, 'property name', 64);
    const plan = await env.DB.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').bind(user.id).first<{ plan: string }>();
    const existing = await env.DB.prepare('SELECT COUNT(*) AS count FROM properties WHERE user_id = ? AND deleted_at IS NULL').bind(user.id).first<{ count: number }>();
    if ((existing?.count ?? 0) >= planLimits(plan?.plan ?? 'free').properties) return json({ error: 'Your current plan has reached its property limit.' }, 403);
    const googleProperty = await verifyGa4Property(user.id, propertyName, env);
    const connection = await env.DB.prepare("SELECT id FROM oauth_connections WHERE user_id = ? AND provider = 'google'").bind(user.id).first<{ id: string }>();
    if (!connection) return json({ error: 'Google Analytics is not connected.' }, 409);
    const ga4PropertyId = googleProperty.name.replace('properties/', '');
    const propertyId = id();
    await env.DB.prepare('INSERT INTO properties (id, user_id, oauth_connection_id, ga4_property_id, display_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(propertyId, user.id, connection.id, ga4PropertyId, googleProperty.displayName, 'active', now()).run();
    return json({ property: { id: propertyId, ga4PropertyId, displayName: googleProperty.displayName } }, 201);
  } catch (error) {
    return errorResponse(error);
  }
};
