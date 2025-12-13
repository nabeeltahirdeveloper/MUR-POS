import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List all purchase orders with items
export async function GET() {
    try {
        const purchaseOrders = await prisma.purchaseOrder.findMany({
            include: {
                supplier: true,
                items: {
                    include: {
                        item: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            data: purchaseOrders,
        });
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch purchase orders' },
            { status: 500 }
        );
    }
}

// POST - Create a new purchase order with items
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { supplierId, items, status } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one item is required' },
                { status: 400 }
            );
        }

        // Calculate total amount
        const totalAmount = items.reduce((total: number, item: { qty: number; pricePerUnit: number }) => {
            return total + (item.qty * item.pricePerUnit);
        }, 0);

        const purchaseOrder = await prisma.purchaseOrder.create({
            data: {
                supplierId: supplierId ? parseInt(supplierId) : null,
                status: status || 'pending',
                totalAmount,
                items: {
                    create: items.map((item: { itemId: number; qty: number; pricePerUnit: number }) => ({
                        itemId: parseInt(String(item.itemId)),
                        qty: item.qty,
                        pricePerUnit: item.pricePerUnit,
                    })),
                },
            },
            include: {
                supplier: true,
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: purchaseOrder,
        });
    } catch (error) {
        console.error('Error creating purchase order:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create purchase order' },
            { status: 500 }
        );
    }
}
