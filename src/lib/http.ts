export class HttpError extends Error {
  constructor(readonly status: number, readonly message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}

export async function body<T>(request: Request): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'JSON body required');
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, 'Malformed JSON body');
  }
}

export function assertString(value: unknown, name: string, max = 255) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `Invalid ${name}`);
  return value.trim();
}

export function assertSameOrigin(request: Request, appUrl: string) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(appUrl).origin) throw new HttpError(403, 'Invalid request origin');
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  return json({ error: 'Unable to process the request.' }, 500);
}
