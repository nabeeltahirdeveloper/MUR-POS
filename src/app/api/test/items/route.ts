import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all items with relations
export async function GET() {
    try {
        const items = await prisma.item.findMany({
            include: {
                category: true,
                baseUnit: true,
                saleUnit: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Also get low stock items
        const lowStockItems = await prisma.item.findMany({
            where: {
                stockLogs: {
                    some: {}, // Has at least one stock log
                },
            },
            include: {
                category: true,
                baseUnit: true,
                stockLogs: true,
            },
        });

        // Calculate current stock for each item
        const itemsWithStock = await Promise.all(
            items.map(async (item) => {
                const stockLogs = await prisma.stockLog.findMany({
                    where: { itemId: item.id },
                });

                const currentStock = stockLogs.reduce((total, log) => {
                    const qty = Number(log.quantityBaseUnit);
                    return log.type === 'in' ? total + qty : total - qty;
                }, 0);

                const isLowStock = item.minStockLevel
                    ? currentStock < Number(item.minStockLevel)
                    : false;

                return {
                    ...item,
                    currentStock,
                    isLowStock,
                };
            })
        );

        return NextResponse.json({
            success: true,
            data: {
                items: itemsWithStock,
                totalCount: items.length,
                lowStockCount: itemsWithStock.filter(i => i.isLowStock).length,
            },
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch items' },
            { status: 500 }
        );
    }
}

// POST - Create a new item
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, categoryId, baseUnitId, saleUnitId, conversionFactor, minStockLevel } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Item name is required' },
                { status: 400 }
            );
        }

        const item = await prisma.item.create({
            data: {
                name,
                categoryId: categoryId ? parseInt(categoryId) : null,
                baseUnitId: baseUnitId ? parseInt(baseUnitId) : null,
                saleUnitId: saleUnitId ? parseInt(saleUnitId) : null,
                conversionFactor: conversionFactor || 1,
                minStockLevel: minStockLevel || 0,
            },
            include: {
                category: true,
                baseUnit: true,
                saleUnit: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: item,
        });
    } catch (error) {
        console.error('Error creating item:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create item' },
            { status: 500 }
        );
    }
}
