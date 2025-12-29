import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { getAllDocs } from "@/lib/firestore-helpers";
import { calculateCurrentStock } from "@/lib/inventory";
import type { FirestoreDebt, FirestoreItem, FirestoreUtility } from "@/types/firestore";
import {
  addDays,
  computeDueTriggerAt,
  getReminderById,
  reminderDocId,
  ReminderType,
  resolveReminder,
  upsertReminder,
} from "@/lib/reminders";

const DUE_LEAD_DAYS = 5;
const PENDING_WINDOW_DAYS = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  return token === secret;
}

function isUtilityPaid(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.toLowerCase();
  return s.includes("paid") || s.includes("settled") || s.includes("closed");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

async function upsertLowStockReminders(now: Date) {
  const items = await getAllDocs<FirestoreItem>("items", { orderBy: "name", orderDirection: "asc" });

  let checked = 0;
  let triggered = 0;
  let resolved = 0;

  for (const item of items) {
    checked += 1;
    const min = item.minStockLevel ?? null;
    if (min === null || min === undefined) continue;

    const currentStock = await calculateCurrentStock(item.id);
    const isLow = currentStock <= Number(min);
    const id = reminderDocId("low_stock", item.id);

    if (isLow) {
      triggered += 1;
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
    } else {
      // Auto-resolve if a reminder exists and is still active.
      const existing = await getReminderById(id);
      if (existing && existing.resolvedAt === null) {
        await resolveReminder(id, true);
        resolved += 1;
      }
    }
  }

  return { checked, triggered, resolved };
}

async function upsertDueReminders<T extends { id: string; dueDate?: any; createdAt: any }>(params: {
  type: Extract<ReminderType, "bill_due" | "debt_due">;
  collection: "utilities" | "debts";
  docs: (T & { id: string })[];
  now: Date;
  titleFor: (doc: T & { id: string }, dueDate: Date) => string;
  messageFor: (doc: T & { id: string }, dueDate: Date, triggerAt: Date) => string;
  shouldAutoResolve?: (doc: T & { id: string }) => boolean;
}) {
  const { type, collection, docs, now, titleFor, messageFor, shouldAutoResolve } = params;

  let scanned = 0;
  let upserted = 0;
  let autoResolved = 0;

  for (const doc of docs) {
    scanned += 1;
    const dueDate = doc.dueDate ? new Date(doc.dueDate) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

    const id = reminderDocId(type, doc.id);

    if (shouldAutoResolve?.(doc)) {
      const existing = await getReminderById(id);
      if (existing && existing.resolvedAt === null) {
        await resolveReminder(id, true);
        autoResolved += 1;
      }
      continue;
    }

    const triggerAt = computeDueTriggerAt(dueDate, DUE_LEAD_DAYS);
    const pendingUntil = addDays(now, PENDING_WINDOW_DAYS);
    const inPendingWindow = dueDate <= pendingUntil;
    if (!inPendingWindow) continue;

    const isTriggered = now >= triggerAt;

    await upsertReminder({
      id,
      type,
      source: { collection, id: doc.id },
      title: titleFor(doc, dueDate),
      message: messageFor(doc, dueDate, triggerAt),
      triggerAt,
      triggered: isTriggered,
      resolvedAt: null,
    });
    upserted += 1;
  }

  return { scanned, upserted, autoResolved };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const [itemsResult, utilities, debts] = await Promise.all([
      upsertLowStockReminders(now),
      getAllDocs<FirestoreUtility>("utilities", { orderBy: "dueDate", orderDirection: "asc" }),
      getAllDocs<FirestoreDebt>("debts", { orderBy: "dueDate", orderDirection: "asc" }),
    ]);

    const utilitiesResult = await upsertDueReminders({
      type: "bill_due",
      collection: "utilities",
      docs: utilities,
      now,
      titleFor: (u, due) => `Utility bill due: ${(u as any).name ?? "Utility"}`,
      messageFor: (u, due, trig) =>
        `Due on ${fmtDate(due)} (triggers ${DUE_LEAD_DAYS} days before, on ${fmtDate(trig)}).`,
      shouldAutoResolve: (u) => isUtilityPaid((u as any).status),
    });

    const debtsResult = await upsertDueReminders({
      type: "debt_due",
      collection: "debts",
      docs: debts,
      now,
      titleFor: (d, due) => `Debt due: ${(d as any).personName ?? "Person"}`,
      messageFor: (d, due, trig) =>
        `Due on ${fmtDate(due)} (triggers ${DUE_LEAD_DAYS} days before, on ${fmtDate(trig)}).`,
    });

    // Optional run log for debugging
    await db.collection("cron_runs").add({
      type: "reminders",
      createdAt: now,
      results: {
        lowStock: itemsResult,
        utilities: utilitiesResult,
        debts: debtsResult,
      },
    });

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      results: {
        lowStock: itemsResult,
        utilities: utilitiesResult,
        debts: debtsResult,
      },
    });
  } catch (error) {
    console.error("[cron trigger] failed:", error);
    return NextResponse.json({ error: "Cron trigger failed" }, { status: 500 });
  }
}


