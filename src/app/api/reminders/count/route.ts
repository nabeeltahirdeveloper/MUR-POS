import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/prisma-helpers";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const statusParam = (searchParams.get("status") || "triggered").toLowerCase();

        const where: any = {};

        if (statusParam === "triggered") {
            where.triggered = true;
            where.resolvedAt = null;
        } else if (statusParam === "pending") {
            where.triggered = false;
            where.resolvedAt = null;
        } else {
            where.resolvedAt = null;
        }

        const settings = await getSettings();

        let total = 0;
        if (settings?.notifications?.alertTypes && Array.isArray(settings.notifications.alertTypes)) {
            const allowedTypes = settings.notifications.alertTypes as string[];
            where.type = { in: allowedTypes };
            total = await prisma.reminder.count({ where });
        } else {
            total = await prisma.reminder.count({ where });
        }

        return NextResponse.json({ total });
    } catch (e: any) {
        console.error("[reminders count GET] failed:", e);
        return NextResponse.json(
            { error: "Failed to get reminders count", details: e?.message },
            { status: 500 }
        );
    }
}
