import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllDocs } from "@/lib/firestore-helpers";
import { FirestoreLedger } from "@/types/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch recent ledger entries to determine next order number
        // We'll fetch the last 100 entries sorted by created date (descending)
        // This is a heuristic; for a robust system with high concurrency, a counter document or atomic transaction is better.
        // But for this use case, parsing recent notes is sufficient.

        const entries = await getAllDocs<FirestoreLedger>('ledger', {
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });

        let nextOrderNumber = 1;

        // Iterate through entries to find the highest order number
        for (const entry of entries) {
            if (entry.note) {
                const match = entry.note.match(/Order #(\d+)/);
                if (match) {
                    const currentOrderNum = parseInt(match[1], 10);
                    if (!isNaN(currentOrderNum)) {
                        nextOrderNumber = currentOrderNum + 1;
                        break; // Found the latest one
                    }
                }
            }
        }

        return NextResponse.json({ nextOrderNumber });

    } catch (error) {
        console.error("Error fetching next order number:", error);
        return NextResponse.json(
            { error: "Failed to fetch next order number" },
            { status: 500 }
        );
    }
}
