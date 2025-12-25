import { NextResponse } from "next/server";
import { getAllDocs } from "@/lib/firestore-helpers";
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
