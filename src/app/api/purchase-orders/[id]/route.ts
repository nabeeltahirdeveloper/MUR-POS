import { NextRequest, NextResponse } from "next/server";
import { getDocById, queryDocs, deleteDoc, softDeleteDoc } from "@/lib/prisma-helpers";
import { auth } from "@/auth";
import type { FirestorePurchaseOrder, FirestoreSupplier, FirestorePurchaseOrderItem, FirestoreItem, FirestoreUnit, FirestoreCategory } from "@/types/firestore";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const purchaseOrder = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);

        if (!purchaseOrder) {
            return NextResponse.json(
                { error: "Purchase Order not found" },
                { status: 404 }
            );
        }

        // Fetch supplier
        const supplier = purchaseOrder.supplierId
            ? await getDocById<FirestoreSupplier>('suppliers', purchaseOrder.supplierId)
            : null;

        // Fetch items
        // NOTE: Do not add Firestore `orderBy` here unless you also create the required composite index.
        // We intentionally fetch without ordering (simple equality query) to avoid index requirements.
        // If you need stable ordering, sort in-memory by document id.
        const poItems = await queryDocs<FirestorePurchaseOrderItem>('purchase_order_items', [
            { field: 'orderId', operator: '==', value: id }
        ]);

        poItems.sort((a, b) => a.id.localeCompare(b.id));

        // Fetch item details for each PO item
        const itemsWithDetails = await Promise.all(
            poItems.map(async (poItem) => {
                const item = await getDocById<FirestoreItem>('items', poItem.itemId);
                const category = item?.categoryId
                    ? await getDocById<FirestoreCategory>("categories", item.categoryId)
                    : null;
                const baseUnit = item?.baseUnitId
                    ? await getDocById<FirestoreUnit>('units', item.baseUnitId)
                    : null;
                return {
                    ...poItem,
                    item: item ? {
                        ...item,
                        category,
                        baseUnit,
                    } : null,
                };
            })
        );

        return NextResponse.json({
            ...purchaseOrder,
            supplier,
            items: itemsWithDetails,
        });
    } catch (error) {
        console.error("Error fetching purchase order:", error);
        return NextResponse.json(
            { error: "Failed to fetch purchase order" },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { supplierId, notes, terms } = body;

        const currentPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);

        if (!currentPO) {
            return NextResponse.json(
                { error: "Purchase Order not found" },
                { status: 404 }
            );
        }

        if (currentPO.status === "received" || currentPO.status === "cancelled") {
            return NextResponse.json(
                { error: "Cannot edit Purchase Order in final state" },
                { status: 400 }
            );
        }

        const { updateDoc } = await import('@/lib/prisma-helpers');
        const updateData: Partial<FirestorePurchaseOrder> = {
            notes: notes !== undefined ? notes : null,
            terms: terms !== undefined ? terms : null,
        };
        if (supplierId !== undefined) updateData.supplierId = supplierId || null;

        await updateDoc<Partial<FirestorePurchaseOrder>>('purchase_orders', id, updateData);

        const updatedPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);
        if (!updatedPO) {
            return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
        }


        const supplier = updatedPO.supplierId
            ? await getDocById<FirestoreSupplier>('suppliers', updatedPO.supplierId)
            : null;

        return NextResponse.json({
            ...updatedPO,
            supplier,
        });
    } catch (error) {
        console.error("Error updating purchase order:", error);
        return NextResponse.json(
            { error: "Failed to update purchase order" },
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

        // Check availability
        const currentPO = await getDocById<FirestorePurchaseOrder>('purchase_orders', id);
        if (!currentPO) {
            return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
        }

        // Only allow deleting drafts or possibly cancelled/pending
        // Assuming we want to allow deleting any PO except maybe 'received' ones if it affects stock?
        // For now, let's just allow deleting any PO as requested, maybe restrict received?
        // User asked "give the option for delete order", let's assume all for now or check safety.
        // Usually you don't delete 'received' orders as they affect inventory/ledger history.
        // But let's assume user wants to delete.

        const session = await auth();
        const deletedByUser = session?.user?.email || session?.user?.name || 'unknown';
        await softDeleteDoc('purchase_orders', id, deletedByUser);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting purchase order:", error);
        return NextResponse.json(
            { error: "Failed to delete purchase order" },
            { status: 500 }
        );
    }
}
