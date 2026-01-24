import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSuppliersSummaries } from "@/lib/ledger-balance";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
        const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : null;

        if (toDate) {
            toDate.setHours(23, 59, 59, 999);
        }

        // Fetch and filter summaries
        let suppliers: any[] = await getSuppliersSummaries();

        // Apply Date Filtering if needed
        if (fromDate || toDate) {
            suppliers = suppliers.filter((s: any) => {
                const date = s.lastEntryDate;
                if (fromDate && date < fromDate) return false;
                if (toDate && date > toDate) return false;
                return true;
            });
        }

        return NextResponse.json(suppliers);
    } catch (error) {
        console.error("Error fetching ledger suppliers:", error);
        return NextResponse.json(
            { error: "Failed to fetch ledger suppliers" },
            { status: 500 }
        );
    }
}
