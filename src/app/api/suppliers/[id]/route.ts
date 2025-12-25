import { NextRequest, NextResponse } from "next/server";
import { updateDoc, getDocById, deleteDoc } from "@/lib/firestore-helpers";
import { db } from "@/lib/firestore";
import type { FirestoreSupplier } from "@/types/firestore";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
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
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;

        // Check for existing POs
        const poSnapshot = await db.collection('purchase_orders')
            .where('supplierId', '==', id)
            .limit(1)
            .get();

        if (!poSnapshot.empty) {
            return NextResponse.json(
                { error: "Cannot delete supplier with existing Purchase Orders" },
                { status: 400 }
            );
        }

        await deleteDoc('suppliers', id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting supplier:", error);
        return NextResponse.json(
            { error: "Failed to delete supplier" },
            { status: 500 }
        );
    }
}
