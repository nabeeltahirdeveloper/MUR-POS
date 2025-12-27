import { NextRequest, NextResponse } from "next/server";
import { getDocById, queryDocs } from "@/lib/firestore-helpers";
import type { FirestorePurchaseOrder, FirestoreSupplier, FirestorePurchaseOrderItem, FirestoreItem, FirestoreUnit } from "@/types/firestore";

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
        const poItems = await queryDocs<FirestorePurchaseOrderItem>('purchase_order_items', [
            { field: 'orderId', operator: '==', value: id }
        ], {
            orderBy: 'id',
            orderDirection: 'asc',
        });

        // Fetch item details for each PO item
        const itemsWithDetails = await Promise.all(
            poItems.map(async (poItem) => {
                const item = await getDocById<FirestoreItem>('items', poItem.itemId);
                const baseUnit = item?.baseUnitId 
                    ? await getDocById<FirestoreUnit>('units', item.baseUnitId)
                    : null;
                return {
                    ...poItem,
                    item: item ? {
                        ...item,
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

        const { updateDoc } = await import('@/lib/firestore-helpers');
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
