type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const value = factory().catch((err) => {
    cache.delete(key);
    throw err;
  });

  cache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

/**
 * Explicitly evict a cache key so the next call re-computes it.
 * Call this from write-path handlers after data mutations.
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Evict all cache keys that start with the given prefix.
 * Useful when you want to bust all daily-summary:* keys, etc.
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
