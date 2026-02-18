import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const statusParam = (searchParams.get("status") || "triggered").toLowerCase();

        let q: FirebaseFirestore.Query = db.collection("reminders");

        if (statusParam === "triggered") {
            q = q.where("triggered", "==", true).where("resolvedAt", "==", null);
        } else if (statusParam === "pending") {
            q = q.where("triggered", "==", false).where("resolvedAt", "==", null);
        } else {
            q = q.where("resolvedAt", "==", null);
        }

        // Fetch settings for notification preferences
        const settingsSnap = await db.collection("settings").doc("global").get();
        const settings = settingsSnap.exists ? settingsSnap.data() : null;

        // If we have filters, we can't use q.count() easily because Firestore aggregate count
        // doesn't support client-side filtering. However, if there are NO filters, q.count() is better.
        // But the requirements say we MUST filter by type if settings exist.

        let total = 0;
        if (settings?.notifications?.alertTypes && Array.isArray(settings.notifications.alertTypes)) {
            const allowedTypes = new Set(settings.notifications.alertTypes);
            // If we have type filters, we must fetch documents or use multiple count queries.
            // For simplicity and matching route.ts, let's fetch IDs only or just query with filters.
            // Optimization: If allowedTypes is small, we could do multiple counts.
            // But for now, let's fetch to be accurate with filters.
            const snap = await q.get();
            total = snap.docs.filter(doc => allowedTypes.has(doc.data().type)).length;
        } else {
            const agg = await q.count().get();
            total = agg.data().count ?? 0;
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
