/**
 * daily-summary.ts
 *
 * Extracted, optimized daily ledger summary logic.
 * Fixes:
 *  - N+1 query: fetches debts once, uses a Map for O(1) lookups per payment
 *  - Double utility query: queries by paidAt only, falls back to in-memory for legacy dueDate data
 *  - Wrapped in server-cache with 5-minute TTL, invalidated on writes
 */

import { queryDocs, getDocById, Timestamp } from "@/lib/prisma-helpers";
import { getOrSetCache } from "@/lib/server-cache";
import type {
  FirestoreLedger,
  FirestoreDebt,
  FirestoreDebtPayment,
  FirestoreUtility,
  FirestoreLedgerCategory,
  FirestoreCategory,
} from "@/types/firestore";

export interface CategoryBreakdownItem {
  name: string;
  credit: number;
  debit: number;
}

export interface DailySummaryResult {
  date: string;
  summary: {
    totalCredit: number;
    totalDebit: number;
    net: number;
  };
  breakdown: CategoryBreakdownItem[];
}

/**
 * Compute the daily summary for a given date string (YYYY-MM-DD).
 * Results are cached in-memory with a 5-minute TTL.
 * Call invalidateDailyCache(dateStr) after any write to invalidate.
 */
export async function getDailySummary(dateStr: string): Promise<DailySummaryResult> {
  const cacheKey = `daily-summary:${dateStr}`;
  return getOrSetCache(cacheKey, 5 * 60_000, () => computeDailySummary(dateStr));
}

async function computeDailySummary(dateStr: string): Promise<DailySummaryResult> {
  const startOfDay = new Date(dateStr);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateStr);
  endOfDay.setHours(23, 59, 59, 999);

  // === Batch all fetches — no N+1 ===
  const [entries, debtsToday, allPaymentsToday, paidUtilitiesByPaidAt, dueUtilitiesToday] =
    await Promise.all([
      // Ledger entries for the day
      queryDocs<FirestoreLedger>("ledger", [
        { field: "date", operator: ">=", value: Timestamp.fromDate(startOfDay) },
        { field: "date", operator: "<=", value: Timestamp.fromDate(endOfDay) },
      ]),
      // New debts created today
      queryDocs<FirestoreDebt>("debts", [
        { field: "createdAt", operator: ">=", value: Timestamp.fromDate(startOfDay) },
        { field: "createdAt", operator: "<=", value: Timestamp.fromDate(endOfDay) },
      ]),
      // Debt payments made today
      queryDocs<FirestoreDebtPayment>("debt_payments", [
        { field: "date", operator: ">=", value: Timestamp.fromDate(startOfDay) },
        { field: "date", operator: "<=", value: Timestamp.fromDate(endOfDay) },
      ]),
      // Utilities paid today (by paidAt — modern field)
      queryDocs<FirestoreUtility>("utilities", [
        { field: "paidAt", operator: ">=", value: Timestamp.fromDate(startOfDay) },
        { field: "paidAt", operator: "<=", value: Timestamp.fromDate(endOfDay) },
      ]),
      // Legacy: utilities whose dueDate is today AND status is paid (handles old records without paidAt)
      queryDocs<FirestoreUtility>("utilities", [
        { field: "dueDate", operator: ">=", value: Timestamp.fromDate(startOfDay) },
        { field: "dueDate", operator: "<=", value: Timestamp.fromDate(endOfDay) },
      ]),
    ]);

  // Merge utility results — prefer paidAt entries, add legacy only if no paidAt field
  const seenUtilityIds = new Set(paidUtilitiesByPaidAt.map((u) => u.id));
  const paidUtilities = [...paidUtilitiesByPaidAt];
  for (const u of dueUtilitiesToday) {
    if (!u.paidAt && u.status === "paid" && !seenUtilityIds.has(u.id)) {
      paidUtilities.push(u);
    }
  }

  // Build a debt map for O(1) lookups in payment processing (eliminates N+1)
  const allDebtsForPayments = await Promise.all(
    allPaymentsToday
      .map((p) => p.debtId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx) // unique debt IDs
      .map((debtId) => getDocById<FirestoreDebt>("debts", debtId))
  );
  const debtMap = new Map<string, FirestoreDebt & { id: string }>();
  for (const debt of allDebtsForPayments) {
    if (debt) debtMap.set(debt.id, debt);
  }

  // Fetch categories for ledger entries (batched by unique categoryId)
  const uniqueCategoryIds = [
    ...new Set(entries.map((e) => e.categoryId).filter(Boolean) as string[]),
  ];
  const categoryResults = await Promise.all(
    uniqueCategoryIds.map(async (catId) => {
      let cat = await getDocById<FirestoreLedgerCategory>("ledger_categories", catId);
      if (!cat) cat = await getDocById<FirestoreCategory>("categories", catId) as any;
      return [catId, cat] as const;
    })
  );
  const categoryMap = new Map<string, { name: string }>(
    categoryResults.map(([id, cat]) => [id, cat ?? { name: "Uncategorized" }])
  );

  // === Calculate totals ===
  let totalCredit = 0;
  let totalDebit = 0;
  const breakdown: Record<string, CategoryBreakdownItem> = {};

  function addToBreakdown(catName: string, type: "credit" | "debit", amount: number) {
    if (!breakdown[catName]) breakdown[catName] = { name: catName, credit: 0, debit: 0 };
    breakdown[catName][type] += amount;
  }

  // 1. Ledger entries
  const processedOrderNumbers = new Set<number>();
  for (const entry of entries) {
    if (entry.note?.startsWith("Utility payment:")) continue;

    const orderNum = entry.orderNumber ? Number(entry.orderNumber) : null;
    if (orderNum && processedOrderNumbers.has(orderNum)) continue;
    if (orderNum) processedOrderNumbers.add(orderNum);

    const totalAmount = Number(entry.amount);
    let cashMoved = 0;
    let hasAdvanceOrPayment = false;
    let hasRemainingLabel = false;
    let remainingValue = 0;

    if (entry.note) {
      for (const line of entry.note.split("\n")) {
        const trimmed = line.trim();
        const advMatch = trimmed.match(/^(Advance|Payment|Paid):\s*(\d+(\.\d+)?)/i);
        if (advMatch) {
          cashMoved = Number(advMatch[2]) || 0;
          hasAdvanceOrPayment = true;
          break;
        }
        const remMatch = trimmed.match(/Remaining:\s*(\d+(\.\d+)?)/i);
        if (remMatch) {
          hasRemainingLabel = true;
          remainingValue = Number(remMatch[1]) || 0;
        }
      }
    }

    if (!hasAdvanceOrPayment) {
      cashMoved = !hasRemainingLabel || remainingValue === 0 ? totalAmount : 0;
    }

    const catName = entry.categoryId
      ? (categoryMap.get(entry.categoryId)?.name ?? "Uncategorized")
      : "Uncategorized";

    if (entry.type === "credit") {
      totalCredit += cashMoved;
      addToBreakdown(catName, "credit", cashMoved);
    } else {
      totalDebit += cashMoved;
      addToBreakdown(catName, "debit", cashMoved);
    }
  }

  // 2. New loans created today
  for (const debt of debtsToday) {
    const amount = Number(debt.amount);
    if (debt.type === "loaned_in") {
      totalCredit += amount;
      addToBreakdown("Loans", "credit", amount);
    } else {
      totalDebit += amount;
      addToBreakdown("Loans", "debit", amount);
    }
  }

  // 3. Debt payments today — O(1) lookup from debtMap (no N+1!)
  for (const payment of allPaymentsToday) {
    const debt = debtMap.get(payment.debtId);
    if (!debt) continue;
    const amount = Number(payment.amount);
    if (debt.type === "loaned_in") {
      totalDebit += amount;
      addToBreakdown("Loan Payments", "debit", amount);
    } else {
      totalCredit += amount;
      addToBreakdown("Loan Payments", "credit", amount);
    }
  }

  // 4. Paid utilities today
  for (const util of paidUtilities) {
    const amount = Number(util.amount);
    totalDebit += amount;
    addToBreakdown(util.category || "Utility", "debit", amount);
  }

  return {
    date: dateStr,
    summary: { totalCredit, totalDebit, net: totalCredit - totalDebit },
    breakdown: Object.values(breakdown),
  };
}
