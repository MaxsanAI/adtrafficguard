import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/auth';
import { clearCookie, encrypt, id, now } from '../../../lib/security';

function stateCookie(request: Request) {
  return request.headers.get('cookie')?.match(/(?:^|; )atg_oauth_state=([^;]+)/)?.[1];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const user = await requireUser(request, env);
  if (!user) return new Response('Authentication required', { status: 401 });
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!code || !state || state !== stateCookie(request)) return new Response('Invalid OAuth state.', { status: 400, headers: { 'set-cookie': clearCookie('atg_oauth_state') } });

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }),
    });
    if (!tokenResponse.ok) return new Response('Google authorization failed.', { status: 502, headers: { 'set-cookie': clearCookie('atg_oauth_state') } });
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tokens.access_token || !tokens.expires_in) return new Response('Google returned an incomplete authorization response.', { status: 502, headers: { 'set-cookie': clearCookie('atg_oauth_state') } });

    await env.DB.prepare(`INSERT INTO oauth_connections (id, user_id, provider, access_token_ciphertext, refresh_token_ciphertext, expires_at, created_at, updated_at)
      VALUES (?, ?, 'google', ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        access_token_ciphertext = excluded.access_token_ciphertext,
        refresh_token_ciphertext = COALESCE(excluded.refresh_token_ciphertext, oauth_connections.refresh_token_ciphertext),
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`)
      .bind(id(), user.id, await encrypt(tokens.access_token, env.TOKEN_ENCRYPTION_KEY), tokens.refresh_token ? await encrypt(tokens.refresh_token, env.TOKEN_ENCRYPTION_KEY) : null, new Date(Date.now() + tokens.expires_in * 1_000).toISOString(), now(), now())
      .run();
  } catch {
    return new Response('Google authorization could not be completed.', { status: 502, headers: { 'set-cookie': clearCookie('atg_oauth_state') } });
  }

  return new Response(null, { status: 302, headers: { location: new URL('/dashboard/properties?connected=google', request.url).toString(), 'set-cookie': clearCookie('atg_oauth_state') } });
};
