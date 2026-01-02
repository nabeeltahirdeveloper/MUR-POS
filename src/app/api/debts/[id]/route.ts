import { NextRequest, NextResponse } from "next/server";
import { updateDoc, deleteDoc, getDocById, queryDocs } from "@/lib/firestore-helpers";
import type { FirestoreDebt, FirestoreDebtPayment } from "@/types/firestore";

export const runtime = "nodejs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    console.debug('[debts-details] GET id:', id);
    try {
        const debt = await getDocById<FirestoreDebt>('debts', id);
        if (!debt) {
            console.warn('[debts-details] debt not found:', id);
            return NextResponse.json({ error: "Debt not found" }, { status: 404 });
        }

        const payments = await queryDocs<FirestoreDebtPayment>('debt_payments', [
            { field: 'debtId', operator: '==', value: id }
        ]);

        console.debug('[debts-details] payments found:', payments.length);
        return NextResponse.json({ ...debt, payments });
    } catch (error) {
        console.error("Error fetching debt details:", error);
        return NextResponse.json(
            { error: "Failed to fetch debt details" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const { personName, amount, dueDate, note, status } = body;

        const updateData: Partial<FirestoreDebt> = {};
        if (personName !== undefined) updateData.personName = personName;
        if (amount !== undefined) updateData.amount = Number(amount);
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (note !== undefined) updateData.note = note;
        if (status !== undefined) updateData.status = status;

        await updateDoc('debts', id, updateData);

        const updated = await getDocById<FirestoreDebt>('debts', id);
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating debt:", error);
        return NextResponse.json(
            { error: "Failed to update debt" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        // Optional: Delete associated payments first
        const payments = await queryDocs<FirestoreDebtPayment>('debt_payments', [
            { field: 'debtId', operator: '==', value: id }
        ]);

        for (const payment of payments) {
            await deleteDoc('debt_payments', payment.id);
        }

        await deleteDoc('debts', id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting debt:", error);
        return NextResponse.json(
            { error: "Failed to delete debt" },
            { status: 500 }
        );
    }
}
