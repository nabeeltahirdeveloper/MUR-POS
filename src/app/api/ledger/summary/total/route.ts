import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDashboardStats } from "@/lib/dashboard-stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read from the precomputed stats document instead of scanning all collections
    const stats = await getDashboardStats();
    if (!stats) {
      return NextResponse.json({ error: "Stats not available" }, { status: 503 });
    }

    return NextResponse.json({ summary: stats.totalSummary });
  } catch (error) {
    console.error("Error fetching total summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch total summary" },
      { status: 500 }
    );
  }
}
