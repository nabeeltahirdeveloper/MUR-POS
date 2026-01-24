import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/firestore-helpers";
import type { FirestoreSupplier } from "@/types/firestore";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    try {
        let suppliers = await getAllDocs<FirestoreSupplier>('suppliers', {
            orderBy: 'name',
            orderDirection: 'asc',
        });

        // Filter by search term if provided (case-insensitive)
        if (search) {
            const searchLower = search.toLowerCase();
            suppliers = suppliers.filter(supplier =>
                supplier.name.toLowerCase().includes(searchLower) ||
                supplier.phone?.toLowerCase().includes(searchLower)
            );
        }

        const total = suppliers.length;
        const skip = (page - 1) * limit;
        const paginatedSuppliers = suppliers.slice(skip, skip + limit);

        // Fetch balances for the paginated suppliers
        const { getSupplierBalance } = await import('@/lib/ledger-balance');
        const suppliersWithBalances = await Promise.all(
            paginatedSuppliers.map(async (s) => {
                const balance = await getSupplierBalance(s.name);
                return { ...s, balance };
            })
        );

        return NextResponse.json({
            suppliers: suppliersWithBalances,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                page,
                limit,
            },
        });
    } catch (error) {
        console.error("Error fetching suppliers:", error);
        return NextResponse.json(
            { error: "Failed to fetch suppliers" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, phone, address } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const supplierData: Omit<FirestoreSupplier, 'id'> = {
            name,
            phone: phone || null,
            address: address || null,
        };

        const supplierId = await createDoc<Omit<FirestoreSupplier, 'id'>>('suppliers', supplierData);
        const { getDocById } = await import('@/lib/firestore-helpers');
        const supplier = await getDocById<FirestoreSupplier>('suppliers', supplierId);

        return NextResponse.json(supplier, { status: 201 });
    } catch (error) {
        console.error("Error creating supplier:", error);
        return NextResponse.json(
            { error: "Failed to create supplier" },
            { status: 500 }
        );
    }
}
