# AdTrafficGuard

**Detect Suspicious Traffic Before It Becomes a Problem.** AdTrafficGuard is a Cloudflare-native SaaS foundation for publishers to monitor traffic-risk indicators from GA4 and an optional privacy-conscious tracker. It does **not** determine Google’s or any advertising platform’s final invalid-traffic decision.

## Architecture

- **Astro + Cloudflare Pages Functions** delivers the application and API endpoints.
- **D1** stores user-owned, aggregated metrics, alert state, sessions, subscriptions, and audit records; `database/schema.sql` is the Dashboard D1 migration source.
- **KV** is optional but recommended for login/API rate limits. **R2** is reserved for long-term exports; do not keep unlimited raw tracker events in D1.
- A separate Dashboard-configured **Worker + Queue** source establishes the scheduled-analysis deployment shape. Queue consumption, retention execution, and plan-based schedules are intentionally deferred to later phases.
- Google OAuth foundation uses only `analytics.readonly`; encrypted access/refresh credentials stay server-side. The property-selection and GA4 Data API work belong to Phase 2. PayPal webhook verification uses PayPal’s signature-verification API and records event IDs idempotently; subscription checkout is not implemented in Phase 1.

## Local development

1. Install Node 20+ and run `npm install`.
2. Copy `.env.example` to `.env` and set every required secret. Generate a high-entropy session secret and a base64 32-byte `TOKEN_ENCRYPTION_KEY`.
3. Create D1, execute `database/schema.sql` using the Cloudflare Dashboard D1 console, and bind it to Pages as `DB`. Bind a KV namespace as `RATE_LIMIT`.
4. Run `npm run dev`. For local Cloudflare binding emulation, use the Pages tooling supplied by the Cloudflare Dashboard workflow; this repository intentionally contains **no Wrangler configuration file**.

## Cloudflare and GitHub deployment

Connect this repository in **Cloudflare Pages → Create application → Git**. Set framework preset to Astro, build command `npm run build`, output directory `dist`, and configure production bindings/secrets in **Settings → Variables and Secrets**. Bind D1 (`DB`), KV (`RATE_LIMIT`), optional R2 export bucket, and any Queue in the Dashboard. Do not commit credentials.

Create a second Worker in the Dashboard using `worker/scheduled-worker.ts`, bind `ANALYSIS_QUEUE`, and configure Cron Triggers there when the later-phase queue consumer exists. This Phase 1 repository intentionally does not ship a Queue consumer, retention job, or production cron schedule.

## Google configuration

In Google Cloud, enable **Google Analytics Data API** and create a Web OAuth client. Add the exact `GOOGLE_REDIRECT_URI`, configure the consent screen, and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` as Pages secrets. OAuth callback validates state, clears the one-time state cookie, and exchanges code server-side. It does not yet list or connect GA4 properties; that Phase 2 work will use the required Google APIs. Only read-only scope is requested.

## PayPal configuration

Create products/plans in PayPal Developer before the later subscription-checkout phase, then configure `/api/paypal/webhook` as a PayPal webhook. Set `PAYPAL_WEBHOOK_ID`, client credentials, and `PAYPAL_ENVIRONMENT`. The Phase 1 webhook endpoint refuses unverified signatures and records event IDs idempotently. Never mark a plan active from browser data.

## Security and operations

Sessions are opaque, hashed in D1, sent only as HttpOnly SameSite cookies, and expire after 14 days. Passwords use PBKDF2-SHA-256 with unique salts. SQL is parameterized through D1 prepared statements. Middleware protects dashboard/admin routes; per-property APIs must query by both property and authenticated user ID. Production cookies are Secure. Configure CSP, origin allowlists, alerting, and email delivery in the Pages Dashboard before launch.

## Verification

Run `npm run check`, `npm test`, and `npm run build`. The repository contains no `wrangler.toml`, `wrangler.json`, or `wrangler.jsonc` by design.
