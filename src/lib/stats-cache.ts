import { prisma } from "@/lib/prisma";

type CachedDoc<T> = {
  updatedAtMs: number;
  value: T;
};

export async function getOrComputeStats<T>(
  docId: string,
  maxAgeMs: number,
  compute: () => Promise<T>
): Promise<T> {
  const key = `stats:${docId}`;

  const existing = await prisma.systemSetting.findUnique({
    where: { key },
  });

  if (existing) {
    try {
      const data = JSON.parse(existing.value) as Partial<CachedDoc<T>>;
      const updatedAtMs = typeof data?.updatedAtMs === "number" ? data.updatedAtMs : 0;
      if (updatedAtMs > 0 && Date.now() - updatedAtMs < maxAgeMs && data?.value !== undefined) {
        return data.value as T;
      }
    } catch {
      // Invalid JSON, recompute
    }
  }

  const value = await compute();
  const payload: CachedDoc<T> = { updatedAtMs: Date.now(), value };

  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(payload) },
    update: { value: JSON.stringify(payload) },
  });

  return value;
}

/**
 * Invalidate a DB-persisted stats cache entry so the next call recomputes it.
 */
export async function invalidateStatsCache(docId: string): Promise<void> {
  const key = `stats:${docId}`;
  await prisma.systemSetting.deleteMany({ where: { key } });
}
