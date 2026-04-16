import { NextRequest, NextResponse } from "next/server";
import { getAllDocs, createDoc } from "@/lib/prisma-helpers";
import { isSystemLocked } from "@/lib/lock";
import type { FirestoreCustomer } from "@/types/firestore";

export const runtime = "nodejs";

import { getCustomersSummaries } from "@/lib/ledger-balance";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    try {
        const customers = await getAllDocs<FirestoreCustomer>('customers', {
            orderBy: 'name',
            orderDirection: 'asc',
        });

        // Fetch balances
        const summaries = await getCustomersSummaries();

        // Filter by search term if provided (case-insensitive)
        let filteredCustomers = customers;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredCustomers = customers.filter(customer =>
                customer.name.toLowerCase().includes(searchLower) ||
                customer.phone?.toLowerCase().includes(searchLower)
            );
        }

        // Merge balance
        const customersWithBalance = filteredCustomers.map(c => {
            const summary = summaries.find(s => s.name.toLowerCase() === c.name.toLowerCase());
            return {
                ...c,
                balance: summary ? summary.balance : 0
            };
        });

        return NextResponse.json({
            customers: customersWithBalance,
            total: customersWithBalance.length,
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        return NextResponse.json(
            { error: "Failed to fetch customers" },
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

        const customerData: Omit<FirestoreCustomer, 'id'> = {
            name,
            phone: phone || null,
            address: address || null,
        };

        const customerId = await createDoc<Omit<FirestoreCustomer, 'id'>>('customers', customerData);
        const { getDocById } = await import('@/lib/prisma-helpers');
        const customer = await getDocById<FirestoreCustomer>('customers', customerId);

        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        console.error("Error creating customer:", error);
        return NextResponse.json(
            { error: "Failed to create customer" },
            { status: 500 }
        );
    }
}
