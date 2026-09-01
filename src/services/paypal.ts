export async function paypalToken(env: Env) {
  const host = env.PAYPAL_ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const response = await fetch(`${host}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error('PayPal authentication failed');
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error('PayPal did not provide an access token');
  return { host, token: payload.access_token };
}

export async function verifyPaypalWebhook(request: Request, event: unknown, env: Env) {
  const headers = request.headers;
  const requiredHeaders = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'];
  if (!env.PAYPAL_WEBHOOK_ID || requiredHeaders.some((header) => !headers.get(header))) return false;

  const { host, token } = await paypalToken(env);
  const response = await fetch(`${host}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });
  return response.ok && (await response.json() as { verification_status?: string }).verification_status === 'SUCCESS';
}
