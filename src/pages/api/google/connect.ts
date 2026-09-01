import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/auth';
import { cookie, token } from '../../../lib/security';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  if (!await requireUser(request, env)) return new Response('Authentication required', { status: 401 });
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) return new Response('Google Analytics is not configured.', { status: 503 });

  const state = token();
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  }).toString();

  return new Response(null, {
    status: 302,
    headers: { location: authorizationUrl.toString(), 'set-cookie': cookie('atg_oauth_state', state, 600) },
  });
};
