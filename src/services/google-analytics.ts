import { decrypt, encrypt, now } from '../lib/security';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta';
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta';

type Connection = { id: string; access_token_ciphertext: string; refresh_token_ciphertext: string | null; expires_at: string | null };
type GoogleToken = { access_token?: string; expires_in?: number; refresh_token?: string };
export type Ga4Property = { name: string; displayName: string };
export type DailyMetric = { date: string; sessions: number; users: number; engagedSessions: number; engagementRate: number; averageSessionDuration: number; screenPageViews: number };

async function accessToken(connection: Connection, env: Env) {
  if (!connection.expires_at || Date.parse(connection.expires_at) > Date.now() + 60_000) return decrypt(connection.access_token_ciphertext, env.TOKEN_ENCRYPTION_KEY);
  if (!connection.refresh_token_ciphertext) throw new Error('Google connection requires reconnection.');
  const refreshToken = await decrypt(connection.refresh_token_ciphertext, env.TOKEN_ENCRYPTION_KEY);
  const response = await fetch(TOKEN_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  if (!response.ok) throw new Error('Google token refresh failed.');
  const token = await response.json() as GoogleToken;
  if (!token.access_token || !token.expires_in) throw new Error('Google token refresh response was incomplete.');
  const expiresAt = new Date(Date.now() + token.expires_in * 1_000).toISOString();
  await env.DB.prepare('UPDATE oauth_connections SET access_token_ciphertext = ?, refresh_token_ciphertext = COALESCE(?, refresh_token_ciphertext), expires_at = ?, updated_at = ? WHERE id = ?')
    .bind(await encrypt(token.access_token, env.TOKEN_ENCRYPTION_KEY), token.refresh_token ? await encrypt(token.refresh_token, env.TOKEN_ENCRYPTION_KEY) : null, expiresAt, now(), connection.id).run();
  return token.access_token;
}

async function connectionForUser(userId: string, env: Env) {
  const connection = await env.DB.prepare("SELECT id, access_token_ciphertext, refresh_token_ciphertext, expires_at FROM oauth_connections WHERE user_id = ? AND provider = 'google'")
    .bind(userId).first<Connection>();
  if (!connection) throw new Error('Google Analytics is not connected.');
  return connection;
}

async function googleFetch(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`Google Analytics request failed (${response.status}).`);
  return response;
}

export async function listGa4Properties(userId: string, env: Env): Promise<Ga4Property[]> {
  const token = await accessToken(await connectionForUser(userId, env), env);
  const properties: Ga4Property[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${ADMIN_API}/accountSummaries`);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await (await googleFetch(url.toString(), token)).json() as { accountSummaries?: Array<{ propertySummaries?: Ga4Property[] }>; nextPageToken?: string };
    for (const account of result.accountSummaries ?? []) properties.push(...(account.propertySummaries ?? []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return properties;
}

export async function verifyGa4Property(userId: string, propertyName: string, env: Env) {
  if (!/^properties\/\d+$/.test(propertyName)) throw new Error('Invalid GA4 property identifier.');
  const token = await accessToken(await connectionForUser(userId, env), env);
  const result = await (await googleFetch(`${ADMIN_API}/${propertyName}`, token)).json() as Ga4Property;
  if (!result.name || !result.displayName) throw new Error('Google returned an invalid property.');
  return result;
}

export async function fetchDailyMetrics(userId: string, propertyId: string, startDate: string, endDate: string, env: Env): Promise<DailyMetric[]> {
  const token = await accessToken(await connectionForUser(userId, env), env);
  const response = await googleFetch(`${DATA_API}/properties/${propertyId}:runReport`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagedSessions' }, { name: 'engagementRate' }, { name: 'averageSessionDuration' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }] }) });
  const result = await response.json() as { rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }> };
  return (result.rows ?? []).flatMap((row) => {
    const date = row.dimensionValues?.[0]?.value;
    const values = row.metricValues?.map((metric) => Number(metric.value ?? 0)) ?? [];
    if (!date || values.some((value) => !Number.isFinite(value))) return [];
    return [{ date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`, sessions: values[0] ?? 0, users: values[1] ?? 0, engagedSessions: values[2] ?? 0, engagementRate: values[3] ?? 0, averageSessionDuration: values[4] ?? 0, screenPageViews: values[5] ?? 0 }];
  });
}
