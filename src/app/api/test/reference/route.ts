import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get all units and categories
export async function GET() {
    try {
        const [units, categories, ledgerCategories, suppliers] = await Promise.all([
            prisma.unit.findMany({ orderBy: { name: 'asc' } }),
            prisma.category.findMany({ orderBy: { name: 'asc' } }),
            prisma.ledgerCategory.findMany({ orderBy: { name: 'asc' } }),
            prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                units,
                categories,
                ledgerCategories,
                suppliers,
            },
        });
    } catch (error) {
        console.error('Error fetching reference data:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch reference data' },
            { status: 500 }
        );
    }
}
