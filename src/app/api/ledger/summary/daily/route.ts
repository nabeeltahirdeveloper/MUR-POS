import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDailySummary } from "@/lib/daily-summary";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json(
        { error: "Date parameter is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const result = await getDailySummary(dateStr);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching daily summary:", error);
    return NextResponse.json(
      { error: `Failed to fetch daily summary: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
