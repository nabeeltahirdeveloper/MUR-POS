import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const categoryId = parseInt(id);

        if (isNaN(categoryId)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json(
                { error: "Category name is required" },
                { status: 400 }
            );
        }

        const trimmedName = name.trim();

        // Check if name exists for another category
        const existing = await prisma.ledgerCategory.findFirst({
            where: {
                name: trimmedName,
                NOT: { id: categoryId },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: "Category name already exists" },
                { status: 409 }
            );
        }

        const updatedCategory = await prisma.ledgerCategory.update({
            where: { id: categoryId },
            data: { name: trimmedName },
        });

        return NextResponse.json(updatedCategory);
    } catch (error) {
        console.error("Error updating ledger category:", error);
        // Handle Prisma record not found
        if ((error as any).code === "P2025") {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Failed to update category" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const categoryId = parseInt(id);

        if (isNaN(categoryId)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        // Check usage
        const usageCount = await prisma.ledger.count({
            where: { categoryId },
        });

        if (usageCount > 0) {
            return NextResponse.json(
                {
                    error: `Cannot delete category: It is used in ${usageCount} ledger entries.`,
                },
                { status: 400 }
            );
        }

        await prisma.ledgerCategory.delete({
            where: { id: categoryId },
        });

        return NextResponse.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting ledger category:", error);
        if ((error as any).code === "P2025") {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        );
    }
}
