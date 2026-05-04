import { NextRequest, NextResponse } from "next/server";
import { updateDoc, getDocById, deleteDoc, softDeleteDoc } from "@/lib/prisma-helpers";
import { auth } from "@/auth";
import type { ApiCustomer } from "@/types/models";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const customer = await getDocById<ApiCustomer>("customers", id);

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

        await updateDoc<Partial<ApiCustomer>>('customers', id, {
            name,
            phone: phone || null,
            address: address || null,
        });

        const customer = await getDocById<ApiCustomer>('customers', id);
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
        const session = await auth();
        const deletedByUser = session?.user?.email || session?.user?.name || 'unknown';

        await softDeleteDoc('customers', id, deletedByUser);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting customer:", error);
        return NextResponse.json(
            { error: "Failed to delete customer" },
            { status: 500 }
        );
    }
}
