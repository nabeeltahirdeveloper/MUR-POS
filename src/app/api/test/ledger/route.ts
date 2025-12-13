import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List ledger entries with summary
export async function GET() {
    try {
        const ledgerEntries = await prisma.ledger.findMany({
            include: {
                category: true,
            },
            orderBy: { date: 'desc' },
            take: 50,
        });

        // Calculate summary
        const allEntries = await prisma.ledger.findMany();
        const summary = allEntries.reduce(
            (acc, entry) => {
                const amount = Number(entry.amount);
                if (entry.type === 'credit') {
                    acc.totalCredits += amount;
                } else {
                    acc.totalDebits += amount;
                }
                return acc;
            },
            { totalCredits: 0, totalDebits: 0 }
        );

        // Get summary by category
        const categoryBreakdown = await prisma.ledger.groupBy({
            by: ['categoryId', 'type'],
            _sum: {
                amount: true,
            },
        });

        const categories = await prisma.ledgerCategory.findMany();
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));

        const categoryStats = categoryBreakdown.map(item => ({
            categoryId: item.categoryId,
            categoryName: item.categoryId ? categoryMap.get(item.categoryId) : 'Uncategorized',
            type: item.type,
            total: Number(item._sum.amount),
        }));

        return NextResponse.json({
            success: true,
            data: {
                entries: ledgerEntries,
                summary: {
                    ...summary,
                    balance: summary.totalCredits - summary.totalDebits,
                },
                categoryStats,
            },
        });
    } catch (error) {
        console.error('Error fetching ledger entries:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch ledger entries' },
            { status: 500 }
        );
    }
}

// POST - Create a new ledger entry
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, amount, categoryId, note, date } = body;

        if (!type || amount === undefined) {
            return NextResponse.json(
                { success: false, error: 'type and amount are required' },
                { status: 400 }
            );
        }

        if (!['debit', 'credit'].includes(type)) {
            return NextResponse.json(
                { success: false, error: 'Type must be "debit" or "credit"' },
                { status: 400 }
            );
        }

        const ledgerEntry = await prisma.ledger.create({
            data: {
                type,
                amount,
                categoryId: categoryId ? parseInt(categoryId) : null,
                note,
                date: date ? new Date(date) : new Date(),
            },
            include: {
                category: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: ledgerEntry,
        });
    } catch (error) {
        console.error('Error creating ledger entry:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create ledger entry' },
            { status: 500 }
        );
    }
}
