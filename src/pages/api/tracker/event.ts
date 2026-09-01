import type { APIRoute } from 'astro';

type TrackerEvent = { siteId?: unknown; kind?: unknown };

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return new Response(null, { status: 415 });
  if (Number(request.headers.get('content-length') ?? 0) > 4_096) return new Response(null, { status: 413 });

  let event: TrackerEvent;
  try {
    event = await request.json() as TrackerEvent;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof event.siteId !== 'string' || event.siteId.length > 128 || typeof event.kind !== 'string' || event.kind.length > 32) return new Response(null, { status: 400 });

  // Raw tracker events are deliberately not stored in D1. Queue aggregation is configured in Cloudflare Dashboard in a later phase.
  return new Response(null, { status: 202 });
};
