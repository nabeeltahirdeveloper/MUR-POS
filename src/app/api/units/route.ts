import { NextResponse } from "next/server";
import { getAllDocs } from "@/lib/prisma-helpers";
import type { FirestoreUnit } from "@/types/firestore";

export async function GET() {
    try {
        const units = await getAllDocs<FirestoreUnit>('units', {
            orderBy: 'name',
            orderDirection: 'asc',
        });
        return NextResponse.json(units);
    } catch (error) {
        console.error("Error fetching units:", error);
        return NextResponse.json(
            { error: "Failed to fetch units" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, symbol } = body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Unit name is required" },
                { status: 400 }
            );
        }

        const trimmedName = name.trim();
        const trimmedSymbol = symbol ? symbol.trim() : "";

        // Check for duplicate
        const existing = await import('@/lib/prisma-helpers').then(m => m.queryDocs<FirestoreUnit>('units', [
            { field: 'name', operator: '==', value: trimmedName }
        ]));

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "Unit already exists" },
                { status: 409 }
            );
        }

        const createDoc = await import('@/lib/prisma-helpers').then(m => m.createDoc);
        const unitId = await createDoc<Omit<FirestoreUnit, 'id'>>('units', {
            name: trimmedName,
            symbol: trimmedSymbol,
            createdAt: new Date()
        });

        const getDocById = await import('@/lib/prisma-helpers').then(m => m.getDocById);
        const unit = await getDocById<FirestoreUnit>('units', unitId);

        return NextResponse.json(unit, { status: 201 });
    } catch (error) {
        console.error("Error creating unit:", error);
        return NextResponse.json(
            { error: "Failed to create unit" },
            { status: 500 }
        );
    }
}
