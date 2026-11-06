const scheduleIdle = (callback) => {
  if (typeof globalThis.requestIdleCallback === 'function')
    globalThis.requestIdleCallback(callback, { timeout: 1500 });
  else globalThis.setTimeout(callback, 0);
};

// Warm the normal HTTP cache, not a separate service-worker/CacheStorage cache.
// Never await this from gameplay; visible card images retain normal priority.
export async function preloadSeals(
  seals,
  { fetchImage = globalThis.fetch, schedule = scheduleIdle } = {},
) {
  if (typeof fetchImage !== 'function') return;
  const urls = [...new Set(Object.values(seals).flatMap((sizes) => Object.values(sizes)))];
  await new Promise((resolve) => schedule(resolve));
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, urls.length) }, async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try {
          const response = await fetchImage(url, {
            cache: 'force-cache',
            priority: 'low',
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) await response.arrayBuffer();
        } catch {
          // Missing images, offline play, or unsupported preloading never block play.
        }
      }
    }),
  );
}
