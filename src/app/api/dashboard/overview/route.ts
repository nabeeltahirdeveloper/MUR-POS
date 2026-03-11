import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById, queryDocs } from "@/lib/firestore-helpers";
import { getCustomersSummaries, getSuppliersSummaries } from "@/lib/ledger-balance";
import type { FirestoreSettings } from "@/types/firestore";

export const dynamic = "force-dynamic";

type UpcomingRecord = {
  status?: string;
  dueDate?: string | Date;
  amount?: number;
  category?: string;
  [key: string]: unknown;
};

type DebtRecord = {
  status?: string;
  amount?: number;
  personName?: string;
  type?: string;
  dueDate?: string | Date;
  [key: string]: unknown;
};

type PartySummaryLike = {
  name: string;
  balance: number;
  lastEntryDate: string | Date;
};

type PendingLedgerEntry = {
  personName: string;
  remaining: number;
  type: "debit" | "credit";
  date: string | Date;
};

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const origin = new URL(req.url).origin;
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || ymd(new Date());
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const [
      settings,
      dailySummary,
      totalSummary,
      utilities,
      expenses,
      debts,
      suppliers,
      customers,
    ] = await Promise.all([
      getDocById<FirestoreSettings>("settings", "global"),
      fetch(`${origin}/api/ledger/summary/daily?date=${encodeURIComponent(dateStr)}`).then(
        async (r) => (r.ok ? r.json() : null)
      ),
      fetch(`${origin}/api/ledger/summary/total`).then(async (r) => (r.ok ? r.json() : null)),
      queryDocs<UpcomingRecord>("utilities", []),
      queryDocs<UpcomingRecord>("other-expenses", []),
      queryDocs<DebtRecord>("debts", []),
      getSuppliersSummaries(),
      getCustomersSummaries(),
    ]);

    const currency = settings?.currency ?? { symbol: "Rs.", position: "prefix" };

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcomingUtilities = (Array.isArray(utilities) ? utilities : [])
      .filter((u) => u?.status === "unpaid")
      .filter((u) => {
        const d = new Date(u.dueDate);
        d.setHours(0, 0, 0, 0);
        const diff = d.getTime() - now.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        return days <= 7;
      })
      .slice(0, 5);

    const upcomingExpenses = (Array.isArray(expenses) ? expenses : [])
      .filter((e) => e?.status === "unpaid")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    const debtSummary = (Array.isArray(debts) ? debts : []).filter((d) => d?.status === "active").slice(0, 5);

    let pendingLedger: PendingLedgerEntry[] = [];
    if (Array.isArray(suppliers)) {
      pendingLedger = [
        ...pendingLedger,
        ...(suppliers as PartySummaryLike[])
          .filter((s) => s.balance > 0)
          .map((s) => ({
            personName: s.name,
            remaining: s.balance,
            type: "debit",
            date: s.lastEntryDate,
          })),
      ];
    }
    if (Array.isArray(customers)) {
      pendingLedger = [
        ...pendingLedger,
        ...(customers as PartySummaryLike[])
          .filter((c) => c.balance > 0)
          .map((c) => ({
            personName: c.name,
            remaining: c.balance,
            type: "credit",
            date: c.lastEntryDate,
          })),
      ];
    }
    pendingLedger = pendingLedger
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return NextResponse.json({
      date: dateStr,
      currency,
      dailySummary,
      totalSummary,
      upcomingUtilities,
      upcomingExpenses,
      debtSummary,
      pendingLedger,
    });
  } catch (error) {
    console.error("Dashboard overview API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

