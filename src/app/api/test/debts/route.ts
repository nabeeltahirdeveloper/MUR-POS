import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

type DebtWithPayments = Prisma.DebtGetPayload<{
    include: { payments: true };
}>;

type DebtWithBalance = Omit<DebtWithPayments, 'amount'> & {
    amount: number;
    totalPaid: number;
    balance: number;
    isPaidOff: boolean;
};

// GET - List all debts with payments
export async function GET() {
    try {
        const debts = await prisma.debt.findMany({
            include: {
                payments: {
                    orderBy: { date: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const debtsWithBalance: DebtWithBalance[] = debts.map((debt: DebtWithPayments) => {
            const totalPaid = debt.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const balance = Number(debt.amount) - totalPaid;
            const isPaidOff = balance <= 0;

            return {
                ...debt,
                amount: Number(debt.amount),
                totalPaid,
                balance,
                isPaidOff,
            };
        });

        // Summary
        const loanedOut = debtsWithBalance.filter(d => d.type === 'loaned_out');
        const loanedIn = debtsWithBalance.filter(d => d.type === 'loaned_in');

        return NextResponse.json({
            success: true,
            data: {
                debts: debtsWithBalance,
                summary: {
                    totalLoanedOut: loanedOut.reduce((sum, d) => sum + d.amount, 0),
                    totalLoanedIn: loanedIn.reduce((sum, d) => sum + d.amount, 0),
                    outstandingLoanedOut: loanedOut.reduce((sum, d) => sum + d.balance, 0),
                    outstandingLoanedIn: loanedIn.reduce((sum, d) => sum + d.balance, 0),
                    loanedOutCount: loanedOut.length,
                    loanedInCount: loanedIn.length,
                },
            },
        });
    } catch (error) {
        console.error('Error fetching debts:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch debts' },
            { status: 500 }
        );
    }
}

// POST - Create a new debt or add payment
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'add_payment') {
            // Add a payment to existing debt
            const { debtId, amount } = body;

            if (!debtId || amount === undefined) {
                return NextResponse.json(
                    { success: false, error: 'debtId and amount are required for payment' },
                    { status: 400 }
                );
            }

            const payment = await prisma.debtPayment.create({
                data: {
                    debtId: parseInt(debtId),
                    amount,
                },
                include: {
                    debt: true,
                },
            });

            return NextResponse.json({
                success: true,
                data: payment,
            });
        } else {
            // Create new debt
            const { personName, type, amount, dueDate, note } = body;

            if (!personName || !type || amount === undefined) {
                return NextResponse.json(
                    { success: false, error: 'personName, type, and amount are required' },
                    { status: 400 }
                );
            }

            if (!['loaned_out', 'loaned_in'].includes(type)) {
                return NextResponse.json(
                    { success: false, error: 'Type must be "loaned_out" or "loaned_in"' },
                    { status: 400 }
                );
            }

            const debt = await prisma.debt.create({
                data: {
                    personName,
                    type,
                    amount,
                    dueDate: dueDate ? new Date(dueDate) : null,
                    note,
                },
                include: {
                    payments: true,
                },
            });

            return NextResponse.json({
                success: true,
                data: debt,
            });
        }
    } catch (error) {
        console.error('Error creating debt/payment:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create debt/payment' },
            { status: 500 }
        );
    }
}
