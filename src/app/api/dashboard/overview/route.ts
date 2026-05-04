import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSettings } from "@/lib/prisma-helpers";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { getDailySummary } from "@/lib/daily-summary";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || ymd(new Date());
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    // === Read 1 precomputed doc + settings (usually cached) + daily summary (cached 5min) ===
    // Total: 1-3 database reads instead of 20-25
    const [stats, settings, dailySummary] = await Promise.all([
      getDashboardStats(),
      getSettings(),
      getDailySummary(dateStr),
    ]);

    const currency = (settings as any)?.currency ?? { symbol: "Rs.", position: "prefix" };

    return NextResponse.json({
      date: dateStr,
      currency,
      dailySummary,
      totalSummary: stats?.totalSummary ? { summary: stats.totalSummary } : null,
      upcomingUtilities: stats?.pendingUtilities ?? [],
      upcomingExpenses: stats?.pendingExpenses ?? [],
      debtSummary: stats?.debtSummary ?? [],
      pendingLedger: stats?.pendingLedgerEntries ?? [],
    });
  } catch (error) {
    console.error("Dashboard overview API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
