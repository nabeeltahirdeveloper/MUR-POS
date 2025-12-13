import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const type = searchParams.get("type");
        const categoryId = searchParams.get("categoryId");
        const search = searchParams.get("search");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const skip = (page - 1) * limit;

        const where: Prisma.LedgerWhereInput = {};

        if (type && (type === "debit" || type === "credit")) {
            where.type = type;
        }

        if (categoryId) {
            const catId = parseInt(categoryId);
            if (!isNaN(catId)) {
                where.categoryId = catId;
            }
        }

        if (search) {
            where.note = {
                contains: search,
                mode: "insensitive",
            };
        }

        if (from || to) {
            where.date = {};
            if (from) where.date.gte = new Date(from);
            if (to) where.date.lte = new Date(to);
        }

        const [entries, total] = await Promise.all([
            prisma.ledger.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: "desc" },
                include: {
                    category: true,
                },
            }),
            prisma.ledger.count({ where }),
        ]);

        return NextResponse.json({
            data: entries,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching ledger entries:", error);
        return NextResponse.json(
            { error: "Failed to fetch ledger entries" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { type, amount, categoryId, note, date } = body;

        // Validation
        if (!type || (type !== "debit" && type !== "credit")) {
            return NextResponse.json(
                { error: "Type must be 'debit' or 'credit'" },
                { status: 400 }
            );
        }

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { error: "Amount must be greater than 0" },
                { status: 400 }
            );
        }

        if (!categoryId) {
            return NextResponse.json(
                { error: "Category is required" },
                { status: 400 }
            );
        }

        const parsedCategoryId = parseInt(categoryId);
        // Verify category exists
        const categoryExists = await prisma.ledgerCategory.findUnique({
            where: { id: parsedCategoryId },
        });

        if (!categoryExists) {
            return NextResponse.json(
                { error: "Invalid Category ID" },
                { status: 400 }
            );
        }

        const entry = await prisma.ledger.create({
            data: {
                type,
                amount: new Prisma.Decimal(amount),
                categoryId: parsedCategoryId,
                note,
                date: date ? new Date(date) : new Date(),
            },
        });

        return NextResponse.json(entry, { status: 201 });
    } catch (error) {
        console.error("Error creating ledger entry:", error);
        return NextResponse.json(
            { error: "Failed to create ledger entry" },
            { status: 500 }
        );
    }
}
