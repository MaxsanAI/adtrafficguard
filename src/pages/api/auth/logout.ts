import type { APIRoute } from 'astro';
import { deleteSession, requireUser } from '../../../lib/auth';
import { assertSameOrigin, errorResponse, json } from '../../../lib/http';
import { clearCookie } from '../../../lib/security';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = locals.runtime.env;
    assertSameOrigin(request, env.APP_URL);
    if (!await requireUser(request, env)) return json({ error: 'Authentication required' }, 401);
    await deleteSession(request, env);
    return json({ ok: true }, 200, { 'set-cookie': clearCookie('atg_session') });
  } catch (error) {
    return errorResponse(error);
  }
};
