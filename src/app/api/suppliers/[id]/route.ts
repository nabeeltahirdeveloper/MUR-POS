import { NextRequest, NextResponse } from "next/server";
import { updateDoc, getDocById, deleteDoc, queryDocs, softDeleteDoc } from "@/lib/prisma-helpers";
import { auth } from "@/auth";
import type { FirestoreSupplier } from "@/types/firestore";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supplier = await getDocById<FirestoreSupplier>("suppliers", id);

        if (!supplier) {
            return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
        }

        return NextResponse.json(supplier);
    } catch (error) {
        console.error("Error fetching supplier:", error);
        return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
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

        await updateDoc<Partial<FirestoreSupplier>>('suppliers', id, {
            name,
            phone: phone || null,
            address: address || null,
        });

        const supplier = await getDocById<FirestoreSupplier>('suppliers', id);
        if (!supplier) {
            return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
        }

        return NextResponse.json(supplier);
    } catch (error) {
        console.error("Error updating supplier:", error);
        return NextResponse.json(
            { error: "Failed to update supplier" },
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

        // Check for existing POs
        const existingPOs = await queryDocs('purchase_orders', [
            { field: 'supplierId', operator: '==', value: id }
        ], { limit: 1 });

        if (existingPOs.length > 0) {
            return NextResponse.json(
                { error: "Cannot delete supplier with existing Purchase Orders" },
                { status: 400 }
            );
        }

        const session = await auth();
        const deletedByUser = session?.user?.email || session?.user?.name || 'unknown';
        await softDeleteDoc('suppliers', id, deletedByUser);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting supplier:", error);
        return NextResponse.json(
            { error: "Failed to delete supplier" },
            { status: 500 }
        );
    }
}
