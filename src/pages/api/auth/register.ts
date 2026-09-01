import type { APIRoute } from 'astro';
import { createSession, rateLimit } from '../../../lib/auth';
import { assertSameOrigin, assertString, body, errorResponse, HttpError, json } from '../../../lib/http';
import { id, now, passwordHash } from '../../../lib/security';

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    const env = locals.runtime.env;
    assertSameOrigin(request, env.APP_URL);
    if (!await rateLimit(env, `register:${clientAddress}`)) return json({ error: 'Too many requests' }, 429);
    const input = await body<{ email: unknown; password: unknown }>(request);
    const email = assertString(input.email, 'email').toLowerCase();
    const password = assertString(input.password, 'password', 128);
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return json({ error: 'Use a valid email and a password of at least 12 characters.' }, 400);

    const userId = id();
    await env.DB.prepare('INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, email, await passwordHash(password), now(), now()).run();
    await env.DB.prepare("INSERT INTO subscriptions (id, user_id, plan, status, created_at, updated_at) VALUES (?, ?, 'free', 'active', ?, ?)")
      .bind(id(), userId, now(), now()).run();
    return json({ ok: true }, 201, { 'set-cookie': await createSession(userId, env) });
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    return json({ error: 'Unable to create account.' }, 409);
  }
};
