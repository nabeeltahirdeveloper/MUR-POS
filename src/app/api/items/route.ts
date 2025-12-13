import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateCurrentStock, checkLowStock } from "@/lib/inventory";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get("categoryId");
        const search = searchParams.get("search");

        const where: Prisma.ItemWhereInput = {};

        if (categoryId) {
            where.categoryId = parseInt(categoryId);
        }

        if (search) {
            where.name = {
                contains: search,
                mode: "insensitive",
            };
        }

        const items = await prisma.item.findMany({
            where,
            include: {
                category: true,
                baseUnit: true,
                saleUnit: true,
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Calculate stock and low stock status for each item
        const itemsWithStock = await Promise.all(
            items.map(async (item) => {
                const currentStock = await calculateCurrentStock(item.id);
                const isLowStock = await checkLowStock(item.id, currentStock);

                return {
                    ...item,
                    currentStock,
                    isLowStock,
                };
            })
        );

        return NextResponse.json(itemsWithStock);
    } catch (error) {
        console.error("Error fetching items:", error);
        return NextResponse.json(
            { error: "Failed to fetch items" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            categoryId,
            baseUnitId,
            saleUnitId,
            conversionFactor,
            minStockLevel,
        } = body;

        if (!name || !baseUnitId || !saleUnitId) {
            return NextResponse.json(
                { error: "Name, Base Unit, and Sale Unit are required" },
                { status: 400 }
            );
        }

        const newItem = await prisma.item.create({
            data: {
                name,
                categoryId: categoryId ? parseInt(categoryId) : null,
                baseUnitId: parseInt(baseUnitId),
                saleUnitId: parseInt(saleUnitId),
                conversionFactor: conversionFactor ? new Prisma.Decimal(conversionFactor) : 1,
                minStockLevel: minStockLevel ? new Prisma.Decimal(minStockLevel) : 0,
            },
            include: {
                category: true,
                baseUnit: true,
                saleUnit: true,
            },
        });

        return NextResponse.json(newItem, { status: 201 });
    } catch (error) {
        console.error("Error creating item:", error);
        return NextResponse.json(
            { error: "Failed to create item" },
            { status: 500 }
        );
    }
}
