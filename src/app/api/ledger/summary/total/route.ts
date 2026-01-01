import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreLedger } from "@/types/firestore";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const entries = await getAllDocs<FirestoreLedger>('ledger');

        let totalCredit = 0;
        let totalDebit = 0;

        for (const entry of entries) {
            const amount = Number(entry.amount);
            if (entry.type === "credit") {
                totalCredit += amount;
            } else if (entry.type === "debit") {
                totalDebit += amount;
            }
        }

        const net = totalCredit - totalDebit;

        return NextResponse.json({
            summary: {
                totalCredit,
                totalDebit,
                net,
            }
        });
    } catch (error) {
        console.error("Error fetching total summary:", error);
        return NextResponse.json(
            { error: "Failed to fetch total summary" },
            { status: 500 }
        );
    }
}
