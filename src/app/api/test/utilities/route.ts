import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List utilities with due date status
export async function GET() {
    try {
        const utilities = await prisma.utility.findMany({
            orderBy: { dueDate: 'asc' },
        });

        const now = new Date();
        const utilitiesWithStatus = utilities.map((utility) => {
            const dueDate = new Date(utility.dueDate);
            const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            let urgency = 'normal';
            if (daysUntilDue < 0) urgency = 'overdue';
            else if (daysUntilDue <= 3) urgency = 'urgent';
            else if (daysUntilDue <= 7) urgency = 'warning';

            return {
                ...utility,
                daysUntilDue,
                urgency,
            };
        });

        // Separate by status
        const pending = utilitiesWithStatus.filter(u => u.status === 'pending');
        const overdue = utilitiesWithStatus.filter(u => u.urgency === 'overdue');
        const dueThisWeek = utilitiesWithStatus.filter(u => u.urgency !== 'overdue' && u.daysUntilDue <= 7);

        return NextResponse.json({
            success: true,
            data: {
                all: utilitiesWithStatus,
                pending,
                overdue,
                dueThisWeek,
                summary: {
                    total: utilities.length,
                    pendingCount: pending.length,
                    overdueCount: overdue.length,
                    totalAmount: utilities.reduce((sum, u) => sum + Number(u.amount), 0),
                },
            },
        });
    } catch (error) {
        console.error('Error fetching utilities:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch utilities' },
            { status: 500 }
        );
    }
}

// POST - Create a new utility bill
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, amount, dueDate, category, status } = body;

        if (!name || amount === undefined || !dueDate) {
            return NextResponse.json(
                { success: false, error: 'name, amount, and dueDate are required' },
                { status: 400 }
            );
        }

        const utility = await prisma.utility.create({
            data: {
                name,
                amount,
                dueDate: new Date(dueDate),
                category,
                status: status || 'pending',
            },
        });

        return NextResponse.json({
            success: true,
            data: utility,
        });
    } catch (error) {
        console.error('Error creating utility:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create utility' },
            { status: 500 }
        );
    }
}
