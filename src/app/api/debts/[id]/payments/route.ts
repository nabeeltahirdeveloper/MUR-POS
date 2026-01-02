import { NextRequest, NextResponse } from "next/server";
import { createDoc, getDocById, updateDoc, queryDocs } from "@/lib/firestore-helpers";
import type { FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";

export const runtime = "nodejs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: debtId } = await params;
    try {
        const body = await request.json();
        const { amount, date, note } = body;

        if (!amount) {
            return NextResponse.json(
                { error: "Payment amount is required" },
                { status: 400 }
            );
        }

        const debt = await getDocById<FirestoreDebt>('debts', debtId);
        if (!debt) {
            return NextResponse.json({ error: "Debt not found" }, { status: 404 });
        }

        const paymentData: Omit<FirestoreDebtPayment, 'id'> = {
            debtId,
            amount: Number(amount),
            date: date ? new Date(date) : new Date(),
            note: note || null,
        };

        const paymentId = await createDoc<Omit<FirestoreDebtPayment, 'id'>>('debt_payments', paymentData);

        // Check if debt is fully paid
        const payments = await queryDocs<FirestoreDebtPayment>('debt_payments', [
            { field: 'debtId', operator: '==', value: debtId }
        ]);
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

        if (totalPaid >= debt.amount) {
            await updateDoc('debts', debtId, { status: 'paid' });
        }

        return NextResponse.json({ id: paymentId, ...paymentData }, { status: 201 });
    } catch (error) {
        console.error("Error creating debt payment:", error);
        return NextResponse.json(
            { error: "Failed to create payment" },
            { status: 500 }
        );
    }
}
