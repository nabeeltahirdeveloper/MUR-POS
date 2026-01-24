import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCustomersSummaries, PartySummary } from "@/lib/ledger-balance";

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
        let customers: PartySummary[] = await getCustomersSummaries();

        // Apply Date Filtering if needed
        if (fromDate || toDate) {
            customers = customers.filter(c => {
                const date = c.lastEntryDate;
                if (fromDate && date < fromDate) return false;
                if (toDate && date > toDate) return false;
                return true;
            });
        }

        return NextResponse.json(customers);
    } catch (error) {
        console.error("Error fetching ledger customers:", error);
        return NextResponse.json(
            { error: "Failed to fetch ledger customers" },
            { status: 500 }
        );
    }
}
