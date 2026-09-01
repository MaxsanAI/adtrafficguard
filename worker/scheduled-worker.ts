/** Deploy this separate Worker through the Cloudflare Dashboard; no Wrangler configuration is required. */
type Queue = { send(message: { kind: string; at: string }): Promise<void> };
type ScheduledEvent = { scheduledTime: number; cron: string };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };
type ExportedHandler<Env = unknown> = { scheduled?(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> | void };

type ScheduledEnv = { ANALYSIS_QUEUE: Queue };

export default {
  async scheduled(_event, env) {
    await env.ANALYSIS_QUEUE.send({ kind: 'scheduled-analysis', at: new Date().toISOString() });
  },
} satisfies ExportedHandler<ScheduledEnv>;
