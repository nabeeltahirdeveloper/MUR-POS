import { db, Timestamp } from "@/lib/firestore";
import { objectToFirestore, timestampToDate } from "@/lib/firestore-helpers";
import { getDocById } from "@/lib/firestore-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import type { FirestoreItem, FirestoreUtility, FirestoreDebt } from "@/types/firestore";

import type { ReminderSourceRef, ReminderStatus, ReminderType } from "@/lib/reminders-shared";
import {
  reminderDocId,
  reminderTypeLabel,
  startOfDay,
  addDays,
  computeDueTriggerAt,
} from "@/lib/reminders-shared";

export type { ReminderSourceRef, ReminderStatus, ReminderType } from "@/lib/reminders-shared";
export { reminderDocId, reminderTypeLabel, startOfDay, addDays, computeDueTriggerAt } from "@/lib/reminders-shared";

export interface ReminderDoc {
  id: string;
  type: ReminderType;
  source: ReminderSourceRef;
  title: string;
  message?: string | null;
  triggered: boolean;
  triggerAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const REMINDERS_COLLECTION = "reminders" as const;

export function parseDateLike(input: unknown): Date | null {
  // Firestore Timestamp
  const tsDate = timestampToDate(input as any);
  if (tsDate) return tsDate;

  if (input instanceof Date) return input;
  if (typeof input === "string" || typeof input === "number") {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

// startOfDay/addDays/computeDueTriggerAt are re-exported from reminders-shared.ts

function docToReminder(id: string, data: Record<string, any>): ReminderDoc {
  const createdAt = parseDateLike(data.createdAt) ?? new Date(0);
  const updatedAt = parseDateLike(data.updatedAt) ?? createdAt;
  const triggerAt = parseDateLike(data.triggerAt) ?? createdAt;
  const resolvedAt = parseDateLike(data.resolvedAt);

  return {
    id,
    type: data.type as ReminderType,
    source: data.source as ReminderSourceRef,
    title: String(data.title ?? ""),
    message: (data.message ?? null) as string | null,
    triggered: Boolean(data.triggered),
    triggerAt,
    resolvedAt: resolvedAt ?? null,
    createdAt,
    updatedAt,
  };
}

export async function getReminderById(id: string): Promise<ReminderDoc | null> {
  const snap = await db.collection(REMINDERS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return docToReminder(snap.id, data);
}

export async function upsertReminder(params: {
  id: string;
  type: ReminderType;
  source: ReminderSourceRef;
  title: string;
  message?: string | null;
  triggerAt: Date;
  triggered: boolean;
  resolvedAt?: Date | null;
}): Promise<ReminderDoc> {
  const now = new Date();
  const docRef = db.collection(REMINDERS_COLLECTION).doc(params.id);
  const existing = await docRef.get();

  const createdAt = existing.exists
    ? parseDateLike(existing.data()?.createdAt) ?? now
    : now;

  const next: Omit<ReminderDoc, "id"> = {
    type: params.type,
    source: params.source,
    title: params.title,
    message: params.message ?? null,
    triggered: params.triggered,
    triggerAt: params.triggerAt,
    resolvedAt: params.resolvedAt ?? null,
    createdAt,
    updatedAt: now,
  };

  // Use merge so we don’t accidentally wipe fields if you later extend the schema.
  await docRef.set(objectToFirestore(next), { merge: true });

  return { id: params.id, ...next };
}

export async function resolveReminder(id: string, resolved: boolean): Promise<ReminderDoc> {
  const docRef = db.collection(REMINDERS_COLLECTION).doc(id);
  const now = new Date();

  await docRef.set(
    objectToFirestore({
      resolvedAt: resolved ? now : null,
      // If it’s resolved, it should not be “active” in triggered/pending lists.
      triggered: resolved ? false : undefined,
      updatedAt: now,
    }),
    { merge: true }
  );

  const updated = await getReminderById(id);
  if (!updated) {
    throw new Error("Reminder not found after update");
  }
  return updated;
}

export async function deleteReminder(id: string): Promise<void> {
  await db.collection(REMINDERS_COLLECTION).doc(id).delete();
}

/**
 * Ensure the low-stock reminder for an item reflects current reality.
 * This makes low-stock notifications appear immediately after stock changes,
 * without waiting for cron.
 */
export async function syncLowStockReminderForItem(itemId: string): Promise<void> {
  const item = await getDocById<FirestoreItem>("items", String(itemId));
  const id = reminderDocId("low_stock", String(itemId));
  const now = new Date();

  // If item is missing or doesn't have a threshold, resolve any existing reminder.
  const min = item?.minStockLevel ?? null;
  if (!item || min === null || min === undefined) {
    const existing = await getReminderById(id);
    if (existing && existing.resolvedAt === null) {
      await resolveReminder(id, true);
    }
    return;
  }

  const currentStock = await calculateCurrentStock(item.id);
  const isLow = currentStock <= Number(min);

  if (isLow) {
    await upsertReminder({
      id,
      type: "low_stock",
      source: { collection: "items", id: item.id },
      title: `Low stock: ${item.name}`,
      message: `Current stock is ${currentStock}. Minimum is ${Number(min)}.`,
      triggerAt: now,
      triggered: true,
      resolvedAt: null,
    });
    return;
  }

  const existing = await getReminderById(id);
  if (existing && existing.resolvedAt === null) {
    await resolveReminder(id, true);
  }
}

const MILESTONES = [3, 2, 1, 0];

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

export async function syncUtilityReminders(utilityId: string): Promise<void> {
  const u = await getDocById<FirestoreUtility>("utilities", utilityId);
  const now = new Date();
  if (!u || !u.dueDate) return;

  const dueDate = new Date(u.dueDate);
  const isPaid = u.status === "paid";

  // If paid, resolve all milestones
  if (isPaid) {
    for (const lead of MILESTONES) {
      const id = reminderDocId("bill_due", utilityId, `milestone_${lead}`);
      const existing = await getReminderById(id);
      if (existing && existing.resolvedAt === null) {
        await resolveReminder(id, true);
      }
    }
    return;
  }

  // Find the most urgent triggered milestone
  let mostUrgentLead: number | null = null;
  for (const lead of MILESTONES) {
    const triggerAt = computeDueTriggerAt(dueDate, lead);
    if (now >= triggerAt) {
      mostUrgentLead = lead;
      break; // MILESTONES is sorted [3, 2, 1, 0], so first match is most urgent
    }
  }

  // Resolve all milestones except the most urgent one
  for (const lead of MILESTONES) {
    const id = reminderDocId("bill_due", utilityId, `milestone_${lead}`);

    if (lead === mostUrgentLead) {
      // This is the active milestone - upsert it
      const timePrefix = lead === 0 ? "URGENT: " : "";
      const daysDesc = lead === 0 ? "today" : lead === 1 ? "tomorrow" : `in ${lead} days`;
      const categoryLabel = u.category ? ` (${u.category})` : " (General)";

      await upsertReminder({
        id,
        type: "bill_due",
        source: { collection: "utilities", id: utilityId },
        title: `${timePrefix}Utility bill due: ${u.name}${categoryLabel}`,
        message: `Due date is ${fmtDate(dueDate)}. Reminder for ${daysDesc}.`,
        triggerAt: computeDueTriggerAt(dueDate, lead),
        triggered: true,
        resolvedAt: null,
      });
    } else {
      // Resolve any other milestone that might exist
      const existing = await getReminderById(id);
      if (existing && existing.resolvedAt === null) {
        await resolveReminder(id, true);
      }
    }
  }
}

export async function syncDebtReminders(debtId: string): Promise<void> {
  const d = await getDocById<FirestoreDebt>("debts", debtId);
  const now = new Date();
  if (!d || !d.dueDate) return;

  const dueDate = new Date(d.dueDate);
  const isPaid = d.status === "paid";

  // If paid, resolve all milestones
  if (isPaid) {
    for (const lead of MILESTONES) {
      const id = reminderDocId("debt_due", debtId, `milestone_${lead}`);
      const existing = await getReminderById(id);
      if (existing && existing.resolvedAt === null) {
        await resolveReminder(id, true);
      }
    }
    return;
  }

  // Find the most urgent triggered milestone
  let mostUrgentLead: number | null = null;
  for (const lead of MILESTONES) {
    const triggerAt = computeDueTriggerAt(dueDate, lead);
    if (now >= triggerAt) {
      mostUrgentLead = lead;
      break; // MILESTONES is sorted [3, 2, 1, 0], so first match is most urgent
    }
  }

  // Resolve all milestones except the most urgent one
  for (const lead of MILESTONES) {
    const id = reminderDocId("debt_due", debtId, `milestone_${lead}`);

    if (lead === mostUrgentLead) {
      // This is the active milestone - upsert it
      const loanType = d.type === "loaned_in" ? "Loan-In (Payable)" : "Loan-Out (Receivable)";
      const timePrefix = lead === 0 ? "URGENT: " : "";
      const daysDesc = lead === 0 ? "today" : lead === 1 ? "tomorrow" : `in ${lead} days`;

      await upsertReminder({
        id,
        type: "debt_due",
        source: { collection: "debts", id: debtId },
        title: `${timePrefix}${loanType}: ${d.personName}`,
        message: `Due date is ${fmtDate(dueDate)}. Reminder for ${daysDesc}.`,
        triggerAt: computeDueTriggerAt(dueDate, lead),
        triggered: true,
        resolvedAt: null,
      });
    } else {
      // Resolve any other milestone that might exist
      const existing = await getReminderById(id);
      if (existing && existing.resolvedAt === null) {
        await resolveReminder(id, true);
      }
    }
  }
}

export async function listReminders(options: {
  status?: ReminderStatus;
  limit?: number;
  cursor?: string | null;
}): Promise<{ reminders: ReminderDoc[]; nextCursor: string | null }> {
  const status = options.status ?? "all";
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursor = options.cursor ?? null;

  // Prefer server-side query, but fall back to in-memory filtering if Firestore requires an index.
  try {
    let q: FirebaseFirestore.Query = db
      .collection(REMINDERS_COLLECTION)
      .orderBy("updatedAt", "desc");

    if (status === "triggered") {
      q = q.where("triggered", "==", true).where("resolvedAt", "==", null);
    } else if (status === "pending") {
      q = q.where("triggered", "==", false).where("resolvedAt", "==", null);
    } else {
      q = q.where("resolvedAt", "==", null);
    }

    if (cursor) {
      const cursorSnap = await db.collection(REMINDERS_COLLECTION).doc(cursor).get();
      if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }

    const snap = await q.limit(limit).get();
    const reminders = snap.docs.map((d) => docToReminder(d.id, d.data() || {}));
    const nextCursor = reminders.length === limit ? reminders[reminders.length - 1].id : null;
    return { reminders, nextCursor };
  } catch (err) {
    console.error("listReminders query failed, falling back to getAll:", err);
    const snap = await db.collection(REMINDERS_COLLECTION).get();
    let reminders = snap.docs.map((d) => docToReminder(d.id, d.data() || {}));
    reminders = reminders.filter((r) => r.resolvedAt === null);
    if (status === "triggered") reminders = reminders.filter((r) => r.triggered);
    if (status === "pending") reminders = reminders.filter((r) => !r.triggered);
    reminders.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const sliced = reminders.slice(0, limit);
    const nextCursor = sliced.length === limit ? sliced[sliced.length - 1].id : null;
    return { reminders: sliced, nextCursor };
  }
}

export function toTimestamp(d: Date): FirebaseFirestore.Timestamp {
  return Timestamp.fromDate(d);
}


