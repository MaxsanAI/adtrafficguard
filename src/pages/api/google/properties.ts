import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/auth';
import { json } from '../../../lib/http';
import { listGa4Properties } from '../../../services/google-analytics';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = await requireUser(request, locals.runtime.env);
  if (!user) return json({ error: 'Authentication required' }, 401);
  try {
    return json({ properties: await listGa4Properties(user.id, locals.runtime.env) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to retrieve Google Analytics properties.' }, 502);
  }
};
