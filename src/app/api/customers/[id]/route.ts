import { NextRequest, NextResponse } from "next/server";
import { updateDoc, getDocById, deleteDoc } from "@/lib/prisma-helpers";
import type { FirestoreCustomer } from "@/types/firestore";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const customer = await getDocById<FirestoreCustomer>("customers", id);

        if (!customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        return NextResponse.json(customer);
    } catch (error) {
        console.error("Error fetching customer:", error);
        return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, phone, address } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        await updateDoc<Partial<FirestoreCustomer>>('customers', id, {
            name,
            phone: phone || null,
            address: address || null,
        });

        const customer = await getDocById<FirestoreCustomer>('customers', id);
        if (!customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        return NextResponse.json(customer);
    } catch (error) {
        console.error("Error updating customer:", error);
        return NextResponse.json(
            { error: "Failed to update customer" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // In the future, check for existing sales/orders before deleting
        // For now, allow direct deletion

        await deleteDoc('customers', id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting customer:", error);
        return NextResponse.json(
            { error: "Failed to delete customer" },
            { status: 500 }
        );
    }
}
