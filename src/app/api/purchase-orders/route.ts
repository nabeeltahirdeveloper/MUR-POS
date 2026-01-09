import { NextRequest, NextResponse } from "next/server";
import { db, Timestamp } from "@/lib/firestore";
import { queryDocs, getAllDocs, getDocById, createDoc } from "@/lib/firestore-helpers";
import type { FirestorePurchaseOrder, FirestoreSupplier } from "@/types/firestore";


export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    try {
        const filters: Array<{ field: string; operator: '<' | '<=' | '==' | '>' | '>=' | '!=' | 'array-contains' | 'in' | 'array-contains-any'; value: any }> = [];

        // ONLY apply Equality filters to Firestore to allow chaining without composite indexes.
        // Mixing Equality + Inequality (Range) + Sort usually requires specific indexes.
        // To be safe, we filter Status/Supplier in DB, and Date in Memory.
        if (status) {
            filters.push({ field: 'status', operator: '==', value: status });
        }

        if (supplierId) {
            filters.push({ field: 'supplierId', operator: '==', value: supplierId });
        }

        let purchaseOrders: FirestorePurchaseOrder[];

        if (filters.length > 0) {
            // Apply strict equality filters only.
            // DO NOT apply orderBy here to avoid "Equality + Sort" index requirements.
            purchaseOrders = await queryDocs<FirestorePurchaseOrder>('purchase_orders', filters);
        } else {
            // No filters? Safe to use native sort.
            // However, to ensure consistency with Date filtering later, maybe fetch all and sort in memory?
            // "getAllDocs" naturally supports simple ordering.
            // Let's use it for efficiency when no filters are present.
            purchaseOrders = await getAllDocs<FirestorePurchaseOrder>('purchase_orders', {
                orderBy: 'createdAt',
                orderDirection: 'desc',
            });
        }

        // --- In-Memory Filtering and Sorting ---

        // 1. Filter by Date (Inequality)
        if (startDate) {
            const start = new Date(startDate);
            // Ensure we handle timestamp differences correctly
            start.setHours(0, 0, 0, 0);
            purchaseOrders = purchaseOrders.filter(po => {
                const poDate = po.createdAt instanceof Date ? po.createdAt : new Date(po.createdAt);
                return poDate >= start;
            });
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            purchaseOrders = purchaseOrders.filter(po => {
                const poDate = po.createdAt instanceof Date ? po.createdAt : new Date(po.createdAt);
                return poDate <= end;
            });
        }

        // 2. Filter by Search (Supplier Name)
        if (search) {
            const searchLower = search.toLowerCase();
            const supplierIds = new Set<string>();

            // Find matching suppliers
            const allSuppliers = await getAllDocs<FirestoreSupplier>('suppliers');
            allSuppliers.forEach(supplier => {
                if (supplier.name.toLowerCase().includes(searchLower)) {
                    supplierIds.add(supplier.id);
                }
            });

            purchaseOrders = purchaseOrders.filter(po =>
                po.supplierId && supplierIds.has(po.supplierId)
            );
        }

        // 3. Apply Sorting (Always by createdAt DESC)
        // We do this in memory because queryDocs (filtered) didn't sort, and getAllDocs (unfiltered) did.
        // It's safer to just re-sort everything to guarantee order after filtering.
        purchaseOrders.sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
            return dateB - dateA; // Descending
        });

        // 4. Pagination
        const total = purchaseOrders.length;
        const skip = (page - 1) * limit;
        const paginatedPOs = purchaseOrders.slice(skip, skip + limit);

        // Fetch suppliers for page items
        const posWithSuppliers = await Promise.all(
            paginatedPOs.map(async (po) => {
                const supplier = po.supplierId
                    ? await getDocById<FirestoreSupplier>('suppliers', po.supplierId)
                    : null;
                return {
                    ...po,
                    supplier,
                };
            })
        );

        return NextResponse.json({
            purchaseOrders: posWithSuppliers,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                page,
                limit,
            },
        });
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        return NextResponse.json(
            { error: "Failed to fetch purchase orders" },
            { status: 500 }
        );
    }
}


export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { supplierId, notes, terms } = body;

        if (!supplierId) {
            return NextResponse.json(
                { error: "Supplier ID is required" },
                { status: 400 }
            );
        }

        const poData: Omit<FirestorePurchaseOrder, 'id'> = {
            supplierId: supplierId || null,
            notes: notes || null,
            terms: terms || null,
            status: "draft",
            totalAmount: 0,
            createdAt: new Date(),
        };

        const poId = await createDoc<Omit<FirestorePurchaseOrder, 'id'>>('purchase_orders', poData);
        const purchaseOrder = await getDocById<FirestorePurchaseOrder>('purchase_orders', poId);

        if (!purchaseOrder) {
            throw new Error('Failed to fetch created purchase order');
        }

        const supplier = purchaseOrder.supplierId
            ? await getDocById<FirestoreSupplier>('suppliers', purchaseOrder.supplierId)
            : null;

        return NextResponse.json({
            ...purchaseOrder,
            supplier,
        }, { status: 201 });
    } catch (error) {
        console.error("Error creating purchase order:", error);
        return NextResponse.json(
            { error: "Failed to create purchase order" },
            { status: 500 }
        );
    }
}
