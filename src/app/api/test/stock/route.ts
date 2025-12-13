import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List stock logs, calculate current stock per item
export async function GET() {
    try {
        const stockLogs = await prisma.stockLog.findMany({
            include: {
                item: {
                    include: {
                        category: true,
                        baseUnit: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // Get items with low stock
        const items = await prisma.item.findMany({
            include: {
                stockLogs: true,
                baseUnit: true,
            },
        });

        const lowStockItems = items.filter((item) => {
            const currentStock = item.stockLogs.reduce((total, log) => {
                const qty = Number(log.quantityBaseUnit);
                return log.type === 'in' ? total + qty : total - qty;
            }, 0);
            return item.minStockLevel ? currentStock < Number(item.minStockLevel) : false;
        }).map((item) => ({
            id: item.id,
            name: item.name,
            currentStock: item.stockLogs.reduce((total, log) => {
                const qty = Number(log.quantityBaseUnit);
                return log.type === 'in' ? total + qty : total - qty;
            }, 0),
            minStockLevel: Number(item.minStockLevel),
            unit: item.baseUnit?.name,
        }));

        return NextResponse.json({
            success: true,
            data: {
                recentLogs: stockLogs,
                lowStockItems,
            },
        });
    } catch (error) {
        console.error('Error fetching stock logs:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch stock logs' },
            { status: 500 }
        );
    }
}

// POST - Create a new stock log entry
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { itemId, type, quantityBaseUnit, description } = body;

        if (!itemId || !type || quantityBaseUnit === undefined) {
            return NextResponse.json(
                { success: false, error: 'itemId, type, and quantityBaseUnit are required' },
                { status: 400 }
            );
        }

        if (!['in', 'out'].includes(type)) {
            return NextResponse.json(
                { success: false, error: 'Type must be "in" or "out"' },
                { status: 400 }
            );
        }

        const stockLog = await prisma.stockLog.create({
            data: {
                itemId: parseInt(itemId),
                type,
                quantityBaseUnit,
                description,
            },
            include: {
                item: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: stockLog,
        });
    } catch (error) {
        console.error('Error creating stock log:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create stock log' },
            { status: 500 }
        );
    }
}
