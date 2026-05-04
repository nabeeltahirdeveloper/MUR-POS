import { NextResponse } from "next/server";
import { createDoc, getAllDocs } from "@/lib/prisma-helpers";
import type { ApiCategory } from "@/types/models";

export async function POST() {
    try {
        // Check if categories already exist
        const existing = await getAllDocs<ApiCategory>('categories');
        
        if (existing.length > 0) {
            return NextResponse.json(
                { message: "Categories already exist", count: existing.length },
                { status: 200 }
            );
        }

        // Create initial categories
        const initialCategories = [
            "Electronics",
            "Clothing",
            "Food",
            "Tools",
            "Office Supplies",
            "Raw Material",
            "Construction",
        ];

        const created = [];
        for (const name of initialCategories) {
            const id = await createDoc<Omit<ApiCategory, 'id'>>('categories', { name });
            created.push({ id, name });
        }

        return NextResponse.json(
            { message: "Categories initialized", created },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error initializing categories:", error);
        return NextResponse.json(
            { error: "Failed to initialize categories" },
            { status: 500 }
        );
    }
}
