import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listReminders } from "@/lib/reminders";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = (searchParams.get("status") || "all").toLowerCase();
    const status =
      statusParam === "triggered" || statusParam === "pending" || statusParam === "all"
        ? (statusParam as "triggered" | "pending" | "all")
        : "all";

    const limit = Number(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    const result = await listReminders({
      status,
      limit: Number.isFinite(limit) ? limit : 20,
      cursor,
    });

    // Check user notification preferences
    const { getSettings } = await import("@/lib/prisma-helpers");
    const settings = await getSettings();

    if (settings && settings.notifications && Array.isArray(settings.notifications.alertTypes)) {
      const allowed = new Set(settings.notifications.alertTypes);
      result.reminders = result.reminders.filter(r => allowed.has(r.type));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[reminders GET] failed:", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}


