import { NextRequest, NextResponse } from "next/server";
import { queryDocs, getDocById } from "@/lib/firestore-helpers";
import type { FirestoreStockLog, FirestoreItem, FirestoreUnit } from "@/types/firestore";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get("itemId");

        if (!itemId) {
            return NextResponse.json(
                { error: "Item ID is required" },
                { status: 400 }
            );
        }

        const logs = await queryDocs<FirestoreStockLog>('stock_logs', [
            { field: 'itemId', operator: '==', value: String(itemId) }
        ], {
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });

        // Fetch item details for each log
        const item = await getDocById<FirestoreItem>('items', String(itemId));
        const baseUnit = item?.baseUnitId ? await getDocById<FirestoreUnit>('units', item.baseUnitId) : null;

        const logsWithItem = logs.map(log => ({
            ...log,
            item: item ? {
                name: item.name,
                baseUnit: baseUnit,
            } : null,
        }));

        return NextResponse.json(logsWithItem);
    } catch (error) {
        console.error("Error fetching stock logs:", error);
        return NextResponse.json(
            { error: "Failed to fetch stock logs" },
            { status: 500 }
        );
    }
}
