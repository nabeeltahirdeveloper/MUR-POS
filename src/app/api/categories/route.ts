import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllDocs, createDoc, queryDocs } from "@/lib/prisma-helpers";
import type { FirestoreCategory } from "@/types/firestore";

export async function GET() {
    try {
        const categories = await getAllDocs<FirestoreCategory>('categories', {
            orderBy: 'name',
            orderDirection: 'asc',
        });
        return NextResponse.json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Category name is required" },
                { status: 400 }
            );
        }

        const trimmedName = name.trim();

        // Check for duplicate
        const existing = await queryDocs<FirestoreCategory>('categories', [
            { field: 'name', operator: '==', value: trimmedName }
        ]);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "Category already exists" },
                { status: 409 }
            );
        }

        const categoryId = await createDoc<Omit<FirestoreCategory, 'id'>>('categories', {
            name: trimmedName,
        });

        const category = await import('@/lib/prisma-helpers').then(m => m.getDocById<FirestoreCategory>('categories', categoryId));

        return NextResponse.json(category, { status: 201 });
    } catch (error) {
        console.error("Error creating category:", error);
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        );
    }
}
