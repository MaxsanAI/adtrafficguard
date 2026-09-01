import type { APIRoute } from 'astro';
import { requireUser } from '../../../../lib/auth';
import { assertSameOrigin, errorResponse, json } from '../../../../lib/http';
import { id, now } from '../../../../lib/security';
import { fetchDailyMetrics } from '../../../../services/google-analytics';
import { planLimits } from '../../../../services/plan-limits';

export const POST: APIRoute = async ({ request, locals, params }) => {
  try {
    const env = locals.runtime.env;
    assertSameOrigin(request, env.APP_URL);
    const user = await requireUser(request, env);
    if (!user || !params.id) return json({ error: 'Property not found.' }, 404);
    const property = await env.DB.prepare('SELECT id, ga4_property_id FROM properties WHERE id = ? AND user_id = ? AND deleted_at IS NULL').bind(params.id, user.id).first<{ id: string; ga4_property_id: string }>();
    if (!property) return json({ error: 'Property not found.' }, 404);
    const subscription = await env.DB.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').bind(user.id).first<{ plan: string }>();
    const historyDays = planLimits(subscription?.plan ?? 'free').historyDays;
    const end = new Date(); const start = new Date(end); start.setUTCDate(start.getUTCDate() - historyDays + 1);
    const metrics = await fetchDailyMetrics(user.id, property.ga4_property_id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), env);
    const statements = metrics.map((metric) => env.DB.prepare(`INSERT INTO daily_metrics (id, property_id, metric_date, sessions, users, engaged_sessions, engagement_rate, avg_engagement_seconds, page_views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(property_id, metric_date) DO UPDATE SET sessions = excluded.sessions, users = excluded.users, engaged_sessions = excluded.engaged_sessions, engagement_rate = excluded.engagement_rate, avg_engagement_seconds = excluded.avg_engagement_seconds, page_views = excluded.page_views`)
      .bind(id(), property.id, metric.date, metric.sessions, metric.users, metric.engagedSessions, metric.engagementRate, metric.averageSessionDuration, metric.screenPageViews, now()));
    if (statements.length) await env.DB.batch(statements);
    return json({ importedDays: metrics.length });
  } catch (error) { return errorResponse(error); }
};
