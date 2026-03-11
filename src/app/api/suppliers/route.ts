import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/firestore-helpers";
import { isSystemLocked } from "@/lib/lock";
import type { FirestoreSupplier } from "@/types/firestore";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    try {
        const suppliers = await getAllDocs<FirestoreSupplier>('suppliers', {
            orderBy: 'name',
            orderDirection: 'asc',
        });

        // Filter by search term if provided (case-insensitive)
        let filteredSuppliers = suppliers;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredSuppliers = suppliers.filter(supplier =>
                supplier.name.toLowerCase().includes(searchLower) ||
                supplier.phone?.toLowerCase().includes(searchLower)
            );
        }

        // Fetch balances for all filtered suppliers
        const { getSupplierBalance } = await import('@/lib/ledger-balance');
        const suppliersWithBalances = await Promise.all(
            filteredSuppliers.map(async (s) => {
                const balance = await getSupplierBalance(s.name);
                return { ...s, balance };
            })
        );

        return NextResponse.json({
            suppliers: suppliersWithBalances,
            total: suppliersWithBalances.length,
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
    if (await isSystemLocked()) {
        return NextResponse.json({ error: "System is locked. Access denied." }, { status: 423 });
    }
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
