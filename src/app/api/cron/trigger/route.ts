import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, getSettings, createDoc } from "@/lib/prisma-helpers";
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

const MILESTONES = [3, 2, 1, 0];
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

function isDebtPaid(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.toLowerCase();
  return s === "paid" || s === "settled" || s === "closed";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

async function upsertDueReminders<T extends { id: string; dueDate?: any; createdAt: any }>(params: {
  type: Extract<ReminderType, "bill_due" | "debt_due">;
  collection: "utilities" | "debts";
  docs: (T & { id: string })[];
  now: Date;
  titleFor: (doc: T & { id: string }, lead: number) => string;
  shouldAutoResolve?: (doc: T & { id: string }) => boolean;
}) {
  const { type, collection, docs, now, titleFor, shouldAutoResolve } = params;

  let scanned = 0;
  let upserted = 0;
  let autoResolved = 0;

  for (const doc of docs) {
    scanned += 1;
    const dueDate = doc.dueDate ? new Date(doc.dueDate) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

    const isPaid = shouldAutoResolve?.(doc);

    // If paid, resolve all milestones for this doc
    if (isPaid) {
      for (const lead of MILESTONES) {
        const id = reminderDocId(type, doc.id, `milestone_${lead}`);
        const existing = await getReminderById(id);
        if (existing && existing.resolvedAt === null) {
          await resolveReminder(id, true);
          autoResolved += 1;
        }
      }
      continue;
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

    // Skip if no milestone has triggered yet
    const pendingUntil = addDays(now, PENDING_WINDOW_DAYS);
    if (dueDate > pendingUntil || mostUrgentLead === null) continue;

    // Upsert the most urgent milestone and resolve all others
    for (const lead of MILESTONES) {
      const id = reminderDocId(type, doc.id, `milestone_${lead}`);

      if (lead === mostUrgentLead) {
        const title = titleFor(doc, lead);
        const daysDesc = lead === 0 ? "today" : lead === 1 ? "tomorrow" : `in ${lead} days`;
        const message = `Due date is ${fmtDate(dueDate)}. Reminder for ${daysDesc}.`;

        await upsertReminder({
          id,
          type,
          source: { collection, id: doc.id },
          title,
          message,
          triggerAt: computeDueTriggerAt(dueDate, lead),
          triggered: true,
          resolvedAt: null,
        });
        upserted += 1;
      } else {
        // Resolve any other milestone that might exist
        const existing = await getReminderById(id);
        if (existing && existing.resolvedAt === null) {
          await resolveReminder(id, true);
          autoResolved += 1;
        }
      }
    }
  }

  return { scanned, upserted, autoResolved };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    // Fetch global settings
    const settings = await getSettings();

    const [items, utilities, debts] = await Promise.all([
      getAllDocs<FirestoreItem>("items", { orderBy: "name", orderDirection: "asc" }),
      getAllDocs<FirestoreUtility>("utilities", { orderBy: "dueDate", orderDirection: "asc" }),
      getAllDocs<FirestoreDebt>("debts", { orderBy: "dueDate", orderDirection: "asc" }),
    ]);

    let itemsResult = { checked: 0, triggered: 0, resolved: 0 };
    if (settings?.inventory?.enableLowStockAlerts !== false) {
      const globalMin = settings?.inventory?.globalMinStockLevel ?? 5;

      for (const item of items) {
        itemsResult.checked += 1;
        const min = item.minStockLevel ?? globalMin;
        const currentStock = await calculateCurrentStock(item.id);
        const isLow = currentStock <= Number(min);
        const id = reminderDocId("low_stock", item.id);

        if (isLow) {
          itemsResult.triggered += 1;
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
          const existing = await getReminderById(id);
          if (existing && existing.resolvedAt === null) {
            await resolveReminder(id, true);
            itemsResult.resolved += 1;
          }
        }
      }
    }

    const utilitiesResult = await upsertDueReminders({
      type: "bill_due",
      collection: "utilities",
      docs: utilities,
      now,
      titleFor: (u, lead) => {
        const timePrefix = lead === 0 ? "URGENT: " : "";
        const categoryLabel = (u as any).category ? ` (${(u as any).category})` : " (General)";
        return `${timePrefix}Utility bill due: ${(u as any).name ?? "Utility"}${categoryLabel}`;
      },
      shouldAutoResolve: (u) => isUtilityPaid((u as any).status),
    });

    const debtsResult = await upsertDueReminders({
      type: "debt_due",
      collection: "debts",
      docs: debts,
      now,
      titleFor: (d, lead) => {
        const debt = d as unknown as FirestoreDebt;
        const loanType = debt.type === "loaned_in" ? "Loan-In (Payable)" : "Loan-Out (Receivable)";
        const timePrefix = lead === 0 ? "URGENT: " : "";
        return `${timePrefix}${loanType}: ${debt.personName}`;
      },
      shouldAutoResolve: (d) => isDebtPaid((d as unknown as FirestoreDebt).status),
    });

    // Optional run log for debugging
    await createDoc("cron_runs", {
      type: "reminders",
      createdAt: now,
      results: JSON.stringify({
        lowStock: itemsResult,
        utilities: utilitiesResult,
        debts: debtsResult,
      }),
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


