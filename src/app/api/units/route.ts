import { NextResponse } from "next/server";
import { getAllDocs } from "@/lib/firestore-helpers";
import type { FirestoreUnit } from "@/types/firestore";

export async function GET() {
    try {
        const units = await getAllDocs<FirestoreUnit>('units', {
            orderBy: 'name',
            orderDirection: 'asc',
        });
        return NextResponse.json(units);
    } catch (error) {
        console.error("Error fetching units:", error);
        return NextResponse.json(
            { error: "Failed to fetch units" },
            { status: 500 }
        );
    }
}
