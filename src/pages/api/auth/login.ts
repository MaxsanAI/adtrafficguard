import type { APIRoute } from 'astro';
import { createSession, rateLimit } from '../../../lib/auth';
import { assertSameOrigin, assertString, body, errorResponse, json } from '../../../lib/http';
import { verifyPassword } from '../../../lib/security';

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    const env = locals.runtime.env;
    assertSameOrigin(request, env.APP_URL);
    if (!await rateLimit(env, `login:${clientAddress}`)) return json({ error: 'Too many attempts' }, 429);
    const input = await body<{ email: unknown; password: unknown }>(request);
    const email = assertString(input.email, 'email').toLowerCase();
    const password = assertString(input.password, 'password', 128);
    const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(email).first<{ id: string; password_hash: string }>();
    if (!user || !await verifyPassword(password, user.password_hash)) return json({ error: 'Invalid email or password.' }, 401);
    return json({ ok: true }, 200, { 'set-cookie': await createSession(user.id, env) });
  } catch (error) {
    return errorResponse(error);
  }
};
