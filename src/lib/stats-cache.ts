import { db } from "@/lib/firebase-admin";

type CachedDoc<T> = {
  updatedAtMs: number;
  value: T;
};

export async function getOrComputeStats<T>(
  docId: string,
  maxAgeMs: number,
  compute: () => Promise<T>
): Promise<T> {
  const ref = db.collection("stats").doc(docId);
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data() as Partial<CachedDoc<T>> | undefined;
    const updatedAtMs = typeof data?.updatedAtMs === "number" ? data.updatedAtMs : 0;
    if (updatedAtMs > 0 && Date.now() - updatedAtMs < maxAgeMs && data?.value !== undefined) {
      return data.value as T;
    }
  }

  const value = await compute();
  const payload: CachedDoc<T> = { updatedAtMs: Date.now(), value };
  await ref.set(payload, { merge: true });
  return value;
}

