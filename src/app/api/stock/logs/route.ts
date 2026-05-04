import { NextRequest, NextResponse } from "next/server";
import { queryDocs, getDocById } from "@/lib/prisma-helpers";
import type { ApiStockLog, ApiItem, ApiUnit } from "@/types/models";

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

        // Query stock logs - try with orderBy first, fallback to without if it fails
        let logs: (ApiStockLog & { id: string })[];
        try {
            logs = await queryDocs<ApiStockLog>('stock_logs', [
                { field: 'itemId', operator: '==', value: String(itemId) }
            ], {
                orderBy: 'createdAt',
                orderDirection: 'desc',
            });
        } catch (orderByError) {
            // If orderBy fails (e.g., missing index), try without orderBy
            logs = await queryDocs<ApiStockLog>('stock_logs', [
                { field: 'itemId', operator: '==', value: String(itemId) }
            ]);
            // Sort manually in memory
            logs.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
                const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
                return dateB - dateA; // desc order
            });
        }

        // Fetch item details for each log
        const item = await getDocById<ApiItem>('items', String(itemId));
        const baseUnit = item?.baseUnitId ? await getDocById<ApiUnit>('units', item.baseUnitId) : null;

        const logsWithItem = logs.map(log => ({
            ...log,
            createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : (typeof log.createdAt === 'string' ? log.createdAt : new Date(log.createdAt).toISOString()),
            item: item ? {
                name: item.name,
                baseUnit: baseUnit,
            } : null,
        }));

        return NextResponse.json(logsWithItem);
    } catch (error) {
        console.error("Error fetching stock logs:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to fetch stock logs", details: errorMessage },
            { status: 500 }
        );
    }
}
