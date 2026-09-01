(() => {
  const script = document.currentScript;
  const siteId = script?.dataset.siteId;
  if (!siteId || siteId.length > 128) return;

  let interactions = 0;
  let maxScroll = 0;
  const startedAt = Date.now();
  const referrer = (() => {
    try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; }
  })();
  const send = (kind) => {
    const payload = JSON.stringify({
      siteId,
      kind,
      at: new Date().toISOString(),
      duration: Math.round((Date.now() - startedAt) / 1000),
      interactions,
      maxScroll,
      referrer,
      viewport: `${innerWidth}x${innerHeight}`,
    });
    navigator.sendBeacon('/api/tracker/event', new Blob([payload], { type: 'application/json' }));
  };

  addEventListener('click', () => { interactions += 1; }, { passive: true });
  addEventListener('scroll', () => { maxScroll = Math.max(maxScroll, Math.round(scrollY / Math.max(1, document.body.scrollHeight - innerHeight) * 100)); }, { passive: true });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send('visibility'); });
  setInterval(() => send('heartbeat'), 30_000);
  addEventListener('pagehide', () => send('pagehide'), { once: true });
  send('pageview');
})();
