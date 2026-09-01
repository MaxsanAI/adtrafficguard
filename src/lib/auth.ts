import { digest, id, now, sessionCookie, token } from './security';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

function requestCookie(request: Request, name: string) {
  return request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1];
}

export async function currentUser(request: Request, env: Env) {
  const rawToken = requestCookie(request, 'atg_session');
  if (!rawToken) return null;
  return env.DB.prepare('SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await digest(rawToken), now())
    .first<{ id: string; email: string; role: 'user' | 'admin' }>();
}

export async function requireUser(request: Request, env: Env) {
  return currentUser(request, env);
}

export async function createSession(userId: string, env: Env) {
  const rawToken = token();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1_000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id(), userId, await digest(rawToken), expiresAt, now())
    .run();
  return sessionCookie(rawToken, SESSION_TTL_SECONDS);
}

export async function deleteSession(request: Request, env: Env) {
  const rawToken = requestCookie(request, 'atg_session');
  if (rawToken) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await digest(rawToken)).run();
}

export async function rateLimit(env: Env, key: string, maximum = 5) {
  if (!env.RATE_LIMIT) return true;
  const storageKey = `rl:${key}`;
  const attempts = Number(await env.RATE_LIMIT.get(storageKey) ?? 0);
  if (!Number.isSafeInteger(attempts) || attempts >= maximum) return false;
  await env.RATE_LIMIT.put(storageKey, String(attempts + 1), { expirationTtl: 900 });
  return true;
}
