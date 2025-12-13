import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentStock, checkLowStock } from "@/lib/inventory";
import { Prisma } from "@prisma/client";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        const item = await prisma.item.findUnique({
            where: { id },
            include: {
                category: true,
                baseUnit: true,
                saleUnit: true,
            },
        });

        if (!item) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        const currentStock = await calculateCurrentStock(item.id);
        const isLowStock = await checkLowStock(item.id, currentStock);

        return NextResponse.json({
            ...item,
            currentStock,
            isLowStock,
        });
    } catch (error) {
        console.error("Error fetching item:", error);
        return NextResponse.json(
            { error: "Failed to fetch item" },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        const body = await request.json();
        const {
            name,
            categoryId,
            baseUnitId,
            saleUnitId,
            conversionFactor,
            minStockLevel,
        } = body;

        // TODO: Add check if we can change units safely if stock exists?
        // Start with basic update.

        const updatedItem = await prisma.item.update({
            where: { id },
            data: {
                name,
                categoryId: categoryId ? parseInt(categoryId) : null,
                baseUnitId: baseUnitId ? parseInt(baseUnitId) : undefined,
                saleUnitId: saleUnitId ? parseInt(saleUnitId) : undefined,
                conversionFactor: conversionFactor ? new Prisma.Decimal(conversionFactor) : undefined,
                minStockLevel: minStockLevel ? new Prisma.Decimal(minStockLevel) : undefined,
            },
            include: {
                category: true,
                baseUnit: true,
                saleUnit: true,
            },
        });

        return NextResponse.json(updatedItem);
    } catch (error) {
        console.error("Error updating item:", error);
        return NextResponse.json(
            { error: "Failed to update item" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);

        // Check for dependencies
        const stockLogsCount = await prisma.stockLog.count({
            where: { itemId: id },
        });

        const poItemsCount = await prisma.purchaseOrderItem.count({
            where: { itemId: id },
        });

        if (stockLogsCount > 0 || poItemsCount > 0) {
            return NextResponse.json(
                {
                    error:
                        "Cannot delete item because it has associated stock logs or purchase orders. Archive it instead.",
                },
                { status: 400 }
            );
        }

        await prisma.item.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Error deleting item:", error);
        return NextResponse.json(
            { error: "Failed to delete item" },
            { status: 500 }
        );
    }
}
