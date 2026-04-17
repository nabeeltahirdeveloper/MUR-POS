import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocById, updateDoc, queryDocs, createDoc } from "@/lib/prisma-helpers";
import type { FirestoreLedger } from "@/types/firestore";
import { isSystemLocked } from "@/lib/lock";
import { triggerDashboardStatsRefresh } from "@/lib/dashboard-stats";
import { invalidateCache, invalidateCacheByPrefix } from "@/lib/server-cache";
import { invalidateStatsCache } from "@/lib/stats-cache";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (await isSystemLocked()) {
            return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
        }

        const { id } = await params;

        // Fetch the entry (getDocById is unfiltered, can find soft-deleted records)
        const entry = await getDocById<FirestoreLedger>('ledger', id);
        if (!entry) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        if (!entry.deletedAt) {
            return NextResponse.json({ error: "Entry is not deleted" }, { status: 400 });
        }

        // 1. Clear soft-delete fields
        await updateDoc('ledger', id, { deletedAt: null, deletedBy: null });

        // 2. Re-apply stock effects (reverse the reversal logs created during delete)
        try {
            const entryId = entry.id;
            const idPattern = new RegExp(`DELETED Ledger #${entryId}\\b`);
            const logs = await queryDocs<any>('stock_logs', [
                { field: 'description', operator: '>=', value: 'Reversion of' },
            ]);
            const reversalLogs = logs.filter((l: any) => idPattern.test(l.description));

            for (const log of reversalLogs) {
                // Reverse the reversal: if reversal was 'out', restore as 'in'
                const restoreType = log.type === 'in' ? 'out' : 'in';
                await createDoc('stock_logs', {
                    itemId: log.itemId,
                    type: restoreType,
                    quantityBaseUnit: log.quantityBaseUnit,
                    description: `Restoration of stock for RESTORED Ledger #${entryId}`,
                    createdAt: new Date()
                });
            }
        } catch (err) {
            console.error("Failed to restore stock for ledger entry:", err);
        }

        // 3. Invalidate caches and refresh dashboard
        const todayStr = new Date().toISOString().split("T")[0];
        invalidateCache(`daily-summary:${todayStr}`);
        invalidateCacheByPrefix("ledger-balance:");
        await Promise.all([
            invalidateStatsCache("ledger_balance_suppliers_v1"),
            invalidateStatsCache("ledger_balance_customers_v1"),
        ]);
        triggerDashboardStatsRefresh();

        return NextResponse.json({ message: "Entry restored successfully" });
    } catch (error) {
        console.error("Error restoring ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to restore entry" },
            { status: 500 }
        );
    }
}
