/**
 * dashboard-stats.ts
 *
 * Manages the precomputed `stats/dashboard-overview` Firestore document.
 *
 * This document is written at write-time (whenever orders, expenses, debts,
 * or utilities change) so the dashboard only needs to read ONE document.
 *
 * Pattern:
 *  - refreshDashboardStats() is called from all write-path API routes
 *  - /api/dashboard/overview reads stats/dashboard-overview (1 Firestore read)
 *  - A debounce prevents N refreshes during bulk operations
 */

import { db } from "@/lib/firebase-admin";
import { getAllDocs, queryDocs } from "@/lib/firestore-helpers";
import { getOrSetCache, invalidateCache } from "@/lib/server-cache";
import type { FirestoreLedger, FirestoreDebt, FirestoreDebtPayment, FirestoreUtility, FirestoreExpense } from "@/types/firestore";

export interface PendingLedgerEntry {
  personName: string;
  remaining: number;
  type: "debit" | "credit";
  date: string;
}

export interface DashboardOverviewStats {
  updatedAt: number;
  pendingUtilities: Array<{
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    category?: string;
  }>;
  pendingExpenses: Array<{
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    category?: string;
  }>;
  debtSummary: Array<{
    id: string;
    personName: string;
    amount: number;
    type: string;
    dueDate?: string;
  }>;
  pendingLedgerEntries: PendingLedgerEntry[];
  totalSummary: {
    totalCredit: number;
    totalDebit: number;
    net: number;
  };
}

const STATS_DOC_ID = "dashboard-overview";
const STATS_COLLECTION = "stats";
const CACHE_KEY = "dashboard-stats:overview:v1";
const CACHE_TTL_MS = 2 * 60_000; // 2 minutes in-memory cache on top of Firestore doc

// Debounce state — prevents thrashing on rapid writes
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1500;

/**
 * Schedule a stats refresh. If called multiple times within DEBOUNCE_MS,
 * only the last call actually runs the refresh. This handles bulk imports gracefully.
 *
 * In production use `refreshDashboardStats()` at the end of write handlers.
 * It is fire-and-forget: the write handler does NOT need to await it.
 */
export function triggerDashboardStatsRefresh(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      await refreshDashboardStats();
    } catch (err) {
      console.error("[dashboard-stats] Background refresh failed:", err);
    }
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

/**
 * Compute and write the stats/dashboard-overview document immediately.
 * Also invalidates the in-memory cache so the next read sees fresh data.
 *
 * Called directly when you need an immediate update (e.g., after a write).
 */
export async function refreshDashboardStats(): Promise<void> {
  const stats = await computeDashboardStats();
  await db.collection(STATS_COLLECTION).doc(STATS_DOC_ID).set(stats, { merge: false });
  // Bust in-memory cache so next call to getDashboardStats() returns fresh data
  invalidateCache(CACHE_KEY);
}

/**
 * Read the precomputed stats doc from Firestore (or in-memory cache).
 * Falls back to a live computation if the doc is missing or older than 1 hour.
 */
export async function getDashboardStats(): Promise<DashboardOverviewStats | null> {
  return getOrSetCache(CACHE_KEY, CACHE_TTL_MS, async () => {
    const snap = await db.collection(STATS_COLLECTION).doc(STATS_DOC_ID).get();
    if (!snap.exists) {
      // First-time: compute and save
      await refreshDashboardStats();
      const fresh = await db.collection(STATS_COLLECTION).doc(STATS_DOC_ID).get();
      return (fresh.data() as DashboardOverviewStats) ?? null;
    }
    const data = snap.data() as DashboardOverviewStats;
    // If data is stale by more than 1 hour, recompute in background
    if (data.updatedAt && Date.now() - data.updatedAt > 60 * 60_000) {
      triggerDashboardStatsRefresh(); // non-blocking
    }
    return data;
  });
}

// ============================================================
// Internal computation — runs against Firestore collections
// ============================================================

async function computeDashboardStats(): Promise<DashboardOverviewStats> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in7Days = new Date(now);
  in7Days.setDate(now.getDate() + 7);

  // Fetch all needed collections in parallel
  const [ledgerEntries, debts, debtPayments, utilities, expenses] = await Promise.all([
    getAllDocs<FirestoreLedger>("ledger"),
    getAllDocs<FirestoreDebt>("debts"),
    getAllDocs<FirestoreDebtPayment>("debt_payments"),
    getAllDocs<FirestoreUtility>("utilities"),
    getAllDocs<FirestoreExpense>("other_expenses"),
  ]);

  // --- Pending Utilities (unpaid, due within 7 days) ---
  const pendingUtilities = utilities
    .filter((u) => {
      if (u.status !== "unpaid" || !u.dueDate) return false;
      const d = toDate(u.dueDate);
      d.setHours(0, 0, 0, 0);
      return d <= in7Days;
    })
    .sort((a, b) => toDate(a.dueDate!).getTime() - toDate(b.dueDate!).getTime())
    .slice(0, 5)
    .map((u) => ({
      id: u.id,
      name: u.name,
      amount: Number(u.amount),
      dueDate: toDate(u.dueDate!).toISOString(),
      category: u.category ?? undefined,
    }));

  // --- Pending Expenses (unpaid) ---
  const pendingExpenses = expenses
    .filter((e) => e.status === "unpaid" && e.dueDate)
    .sort((a, b) => toDate(a.dueDate!).getTime() - toDate(b.dueDate!).getTime())
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      name: e.name,
      amount: Number(e.amount),
      dueDate: toDate(e.dueDate!).toISOString(),
      category: e.category ?? undefined,
    }));

  // --- Active Debts ---
  const debtSummary = debts
    .filter((d) => d.status === "active")
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      personName: d.personName,
      amount: Number(d.amount),
      type: d.type,
      dueDate: d.dueDate ? toDate(d.dueDate).toISOString() : undefined,
    }));

  // --- Pending Ledger Balances (suppliers + customers) ---
  // Build supplier/customer outstanding balances from ledger notes
  const supplierMap = new Map<string, { balance: number; lastDate: Date; type: "debit" }>();
  const customerMap = new Map<string, { balance: number; lastDate: Date; type: "credit" }>();
  const processedOrders = new Set<string>();

  for (const entry of ledgerEntries) {
    if (!entry.note) continue;
    const lines = entry.note.split("\n");
    let supplierName = "";
    let customerName = "";
    let remaining: number | null = null;

    for (const line of lines) {
      const t = line.trim();
      if (t.toLowerCase().startsWith("supplier:")) supplierName = t.substring(9).trim();
      else if (t.toLowerCase().startsWith("customer:")) customerName = t.substring(9).trim();
      else {
        const m = t.match(/remaining:\s*(\d+(\.\d+)?)/i);
        if (m) remaining = Number(m[1]);
      }
    }

    const entryDate = toDate(entry.date ?? new Date());
    const orderKey = entry.orderNumber
      ? `${supplierName || customerName}_${entry.orderNumber}`
      : null;
    if (orderKey && processedOrders.has(orderKey)) continue;
    if (orderKey) processedOrders.add(orderKey);

    if (supplierName && entry.type === "debit" && remaining !== null) {
      const cur = supplierMap.get(supplierName);
      if (!cur || entryDate > cur.lastDate) {
        supplierMap.set(supplierName, { balance: remaining, lastDate: entryDate, type: "debit" });
      }
    }
    if (customerName && entry.type === "credit" && remaining !== null) {
      const cur = customerMap.get(customerName);
      if (!cur || entryDate > cur.lastDate) {
        customerMap.set(customerName, { balance: remaining, lastDate: entryDate, type: "credit" });
      }
    }
  }

  const pendingLedgerEntries: PendingLedgerEntry[] = [
    ...[...supplierMap.entries()]
      .filter(([, v]) => v.balance > 0)
      .map(([name, v]) => ({
        personName: name,
        remaining: v.balance,
        type: "debit" as const,
        date: v.lastDate.toISOString(),
      })),
    ...[...customerMap.entries()]
      .filter(([, v]) => v.balance > 0)
      .map(([name, v]) => ({
        personName: name,
        remaining: v.balance,
        type: "credit" as const,
        date: v.lastDate.toISOString(),
      })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // --- Total Summary (all-time ledger totals) ---
  const debtPaymentMap = new Map<string, FirestoreDebt>();
  for (const d of debts) debtPaymentMap.set(d.id, d);

  let totalCredit = 0;
  let totalDebit = 0;
  const processedTotalOrders = new Set<number>();

  for (const entry of ledgerEntries) {
    if (entry.note?.startsWith("Utility payment:")) continue;
    const orderNum = entry.orderNumber ? Number(entry.orderNumber) : null;
    if (orderNum && processedTotalOrders.has(orderNum)) continue;
    if (orderNum) processedTotalOrders.add(orderNum);

    const totalAmount = Number(entry.amount);
    let cashMoved = 0;
    let hasAdvance = false;
    let hasRemaining = false;
    let remainingVal = 0;

    if (entry.note) {
      for (const line of entry.note.split("\n")) {
        const t = line.trim();
        const adv = t.match(/^(Advance|Payment):\s*(\d+(\.\d+)?)/i);
        if (adv) { cashMoved = Number(adv[2]) || 0; hasAdvance = true; break; }
        const rem = t.match(/Remaining:\s*(\d+(\.\d+)?)/i);
        if (rem) { hasRemaining = true; remainingVal = Number(rem[1]) || 0; }
      }
    }

    if (!hasAdvance) cashMoved = !hasRemaining || remainingVal === 0 ? totalAmount : 0;
    if (entry.type === "credit") totalCredit += cashMoved;
    else if (entry.type === "debit") totalDebit += cashMoved;
  }

  for (const debt of debts) {
    const amount = Number(debt.amount);
    if (debt.type === "loaned_in") totalCredit += amount;
    else if (debt.type === "loaned_out") totalDebit += amount;
  }

  for (const payment of debtPayments) {
    const debt = debtPaymentMap.get(payment.debtId);
    const amount = Number(payment.amount);
    if (debt?.type === "loaned_in") totalDebit += amount;
    else if (debt?.type === "loaned_out") totalCredit += amount;
  }

  for (const util of utilities) {
    if (util.status === "paid") totalDebit += Number(util.amount);
  }

  return {
    updatedAt: Date.now(),
    pendingUtilities,
    pendingExpenses,
    debtSummary,
    pendingLedgerEntries,
    totalSummary: { totalCredit, totalDebit, net: totalCredit - totalDebit },
  };
}

/** Safely convert Firestore Timestamp, Date, or string to JS Date */
function toDate(val: any): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (typeof val.toDate === "function") return val.toDate();
  return new Date(val);
}
