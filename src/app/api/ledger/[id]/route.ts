import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const entryId = parseInt(id);

        if (isNaN(entryId)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const entry = await prisma.ledger.findUnique({
            where: { id: entryId },
            include: { category: true },
        });

        if (!entry) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        return NextResponse.json(entry);
    } catch (error) {
        console.error("Error fetching ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to fetch entry" },
            { status: 500 }
        );
    }
}

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
        const entryId = parseInt(id);
        const body = await req.json();
        const { type, amount, categoryId, note, date } = body;

        const data: Prisma.LedgerUpdateInput = {};

        if (type) {
            if (type !== "debit" && type !== "credit") {
                return NextResponse.json({ error: "Invalid type" }, { status: 400 });
            }
            data.type = type;
        }

        if (amount !== undefined) {
            if (amount <= 0) {
                return NextResponse.json({ error: "Amount must be > 0" }, { status: 400 });
            }
            data.amount = new Prisma.Decimal(amount);
        }

        if (categoryId) {
            const catId = parseInt(categoryId);
            const categoryExists = await prisma.ledgerCategory.findUnique({
                where: { id: catId },
            });
            if (!categoryExists) {
                return NextResponse.json({ error: "Invalid Category" }, { status: 400 });
            }
            data.category = { connect: { id: catId } };
        }

        if (note !== undefined) data.note = note;
        if (date) data.date = new Date(date);

        const updatedEntry = await prisma.ledger.update({
            where: { id: entryId },
            data,
        });

        return NextResponse.json(updatedEntry);
    } catch (error) {
        console.error("Error updating ledger entry:", error);
        if ((error as any).code === "P2025") {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Failed to update entry" },
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
        const entryId = parseInt(id);

        await prisma.ledger.delete({
            where: { id: entryId },
        });

        return NextResponse.json({ message: "Deleted successfully" });
    } catch (error) {
        console.error("Error deleting ledger entry:", error);
        if ((error as any).code === "P2025") {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Failed to delete entry" },
            { status: 500 }
        );
    }
}
