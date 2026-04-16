import { prisma } from "./prisma";
import { getDocById } from "./prisma-helpers";
import { calculateCurrentStock } from "./inventory";
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
  if (input instanceof Date) return input;
  if (typeof input === "string" || typeof input === "number") {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function recordToReminder(record: any): ReminderDoc {
  const source = record.source
    ? (typeof record.source === "string" ? JSON.parse(record.source) : record.source)
    : { collection: "", id: "" };

  return {
    id: record.id,
    type: record.type as ReminderType,
    source,
    title: record.title ?? "",
    message: record.message ?? null,
    triggered: Boolean(record.triggered),
    triggerAt: record.triggerAt ?? record.createdAt ?? new Date(0),
    resolvedAt: record.resolvedAt ?? null,
    createdAt: record.createdAt ?? new Date(0),
    updatedAt: record.updatedAt ?? record.createdAt ?? new Date(0),
  };
}

export async function getReminderById(id: string): Promise<ReminderDoc | null> {
  const record = await prisma.reminder.findUnique({ where: { id } });
  if (!record) return null;
  return recordToReminder(record);
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
  const sourceStr = JSON.stringify(params.source);

  const record = await prisma.reminder.upsert({
    where: { id: params.id },
    create: {
      id: params.id,
      type: params.type,
      referenceId: params.source.id,
      source: sourceStr,
      title: params.title,
      message: params.message ?? null,
      triggered: params.triggered,
      triggerAt: params.triggerAt,
      resolvedAt: params.resolvedAt ?? null,
      createdAt: now,
    },
    update: {
      type: params.type,
      referenceId: params.source.id,
      source: sourceStr,
      title: params.title,
      message: params.message ?? null,
      triggered: params.triggered,
      triggerAt: params.triggerAt,
      resolvedAt: params.resolvedAt ?? null,
    },
  });

  return recordToReminder(record);
}

export async function resolveReminder(id: string, resolved: boolean): Promise<ReminderDoc> {
  const now = new Date();

  const record = await prisma.reminder.update({
    where: { id },
    data: {
      resolvedAt: resolved ? now : null,
      triggered: resolved ? false : undefined,
    },
  });

  return recordToReminder(record);
}

export async function deleteReminder(id: string): Promise<void> {
  try {
    await prisma.reminder.delete({ where: { id } });
  } catch {
    // Ignore if reminder doesn't exist
  }
}

export async function syncLowStockReminderForItem(itemId: string): Promise<void> {
  const item = await getDocById<FirestoreItem>("items", String(itemId));
  const id = reminderDocId("low_stock", String(itemId));

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
      triggerAt: new Date(),
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

  let mostUrgentLead: number | null = null;
  for (const lead of MILESTONES) {
    const triggerAt = computeDueTriggerAt(dueDate, lead);
    if (now >= triggerAt) {
      mostUrgentLead = lead;
      break;
    }
  }

  for (const lead of MILESTONES) {
    const id = reminderDocId("bill_due", utilityId, `milestone_${lead}`);

    if (lead === mostUrgentLead) {
      const timePrefix = lead === 0 ? "URGENT: " : "";
      const categoryLabel = u.category ? ` (${u.category})` : " (General)";

      await upsertReminder({
        id,
        type: "bill_due",
        source: { collection: "utilities", id: utilityId },
        title: `${timePrefix}Utility bill due: ${u.name}${categoryLabel}`,
        message: `Due date is ${fmtDate(dueDate)}.`,
        triggerAt: computeDueTriggerAt(dueDate, lead),
        triggered: true,
        resolvedAt: null,
      });
    } else {
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

  let mostUrgentLead: number | null = null;
  for (const lead of MILESTONES) {
    const triggerAt = computeDueTriggerAt(dueDate, lead);
    if (now >= triggerAt) {
      mostUrgentLead = lead;
      break;
    }
  }

  for (const lead of MILESTONES) {
    const id = reminderDocId("debt_due", debtId, `milestone_${lead}`);

    if (lead === mostUrgentLead) {
      const loanType = d.type === "loaned_in" ? "Loan-In (Payable)" : "Loan-Out (Receivable)";
      const timePrefix = lead === 0 ? "URGENT: " : "";
      await upsertReminder({
        id,
        type: "debt_due",
        source: { collection: "debts", id: debtId },
        title: `${timePrefix}${loanType}: ${d.personName}`,
        message: `Due date is ${fmtDate(dueDate)}.`,
        triggerAt: computeDueTriggerAt(dueDate, lead),
        triggered: true,
        resolvedAt: null,
      });
    } else {
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
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 500);

  const where: any = {};

  if (status === "triggered") {
    where.triggered = true;
    where.resolvedAt = null;
  } else if (status === "pending") {
    where.triggered = false;
    where.resolvedAt = null;
  } else {
    where.resolvedAt = null;
  }

  const records = await prisma.reminder.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const reminders = records.map(recordToReminder);
  const nextCursor = reminders.length === limit ? reminders[reminders.length - 1].id : null;

  return { reminders, nextCursor };
}

export async function deleteUtilityReminders(utilityId: string): Promise<void> {
  for (const lead of MILESTONES) {
    const id = reminderDocId("bill_due", utilityId, `milestone_${lead}`);
    await deleteReminder(id);
  }
}

export async function deleteDebtReminders(debtId: string): Promise<void> {
  for (const lead of MILESTONES) {
    const id = reminderDocId("debt_due", debtId, `milestone_${lead}`);
    await deleteReminder(id);
  }
}
