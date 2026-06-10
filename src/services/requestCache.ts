/**
 * Request coalescer + bounded TTL cache.
 *
 * Two jobs, both aimed at killing redundant network calls on a page load:
 *
 *  1. In-flight coalescing — concurrent callers asking for the SAME key share a
 *     single promise, so a parent + child (or two sibling effects mounting at
 *     once) collapse into one network request instead of two.
 *
 *  2. Short-TTL value cache — a resolved response is served from memory for
 *     `ttlMs`, so org-static data re-requested on every page mount within the
 *     window does not re-hit the network.
 *
 * Failures are never cached: a rejection clears the in-flight entry so the next
 * caller retries cleanly. The value map is hard-capped at `maxEntries` (oldest
 * evicted) so a long session fetching many distinct keys cannot grow unbounded.
 *
 * `now` is injectable so TTL/eviction behaviour is deterministically testable.
 */
export interface RequestCache {
  run<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T>;
  invalidate(prefix?: string): void;
  size(): number;
}

export function createRequestCache(opts?: {
  defaultTtlMs?: number;
  maxEntries?: number;
  now?: () => number;
}): RequestCache {
  const defaultTtlMs = opts?.defaultTtlMs ?? 0;
  const maxEntries = opts?.maxEntries ?? 200;
  const now = opts?.now ?? (() => Date.now());

  const values = new Map<string, { value: unknown; expiresAt: number }>();
  const inFlight = new Map<string, Promise<unknown>>();

  function prune(): void {
    const t = now();
    for (const [k, e] of values) {
      if (e.expiresAt <= t) values.delete(k);
    }
    while (values.size > maxEntries) {
      const oldest = values.keys().next().value;
      if (oldest === undefined) break;
      values.delete(oldest);
    }
  }

  return {
    run<T>(key: string, fetcher: () => Promise<T>, ttlMs = defaultTtlMs): Promise<T> {
      if (ttlMs > 0) {
        const hit = values.get(key);
        if (hit && hit.expiresAt > now()) return Promise.resolve(hit.value as T);
        if (hit) values.delete(key);
      }

      const pending = inFlight.get(key);
      if (pending) return pending as Promise<T>;

      const p = fetcher()
        .then((val) => {
          if (ttlMs > 0) {
            values.set(key, { value: val, expiresAt: now() + ttlMs });
            prune();
          }
          return val;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, p);
      return p as Promise<T>;
    },

    invalidate(prefix?: string): void {
      if (!prefix) {
        values.clear();
        return;
      }
      for (const k of [...values.keys()]) {
        if (k.startsWith(prefix)) values.delete(k);
      }
    },

    size(): number {
      return values.size;
    },
  };
}
