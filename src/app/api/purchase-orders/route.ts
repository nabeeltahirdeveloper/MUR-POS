import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    const where: Prisma.PurchaseOrderWhereInput = {};

    if (status) {
        where.status = status;
    }

    if (supplierId) {
        where.supplierId = parseInt(supplierId);
    }

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
        where.OR = [
            { supplier: { name: { contains: search, mode: "insensitive" } } },
        ];
    }

    try {
        const [purchaseOrders, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                include: { supplier: true },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.purchaseOrder.count({ where }),
        ]);

        return NextResponse.json({
            purchaseOrders,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                page,
                limit,
            },
        });
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        return NextResponse.json(
            { error: "Failed to fetch purchase orders" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { supplierId, notes, terms } = body;

        if (!supplierId) {
            return NextResponse.json(
                { error: "Supplier ID is required" },
                { status: 400 }
            );
        }

        const purchaseOrder = await prisma.purchaseOrder.create({
            data: {
                supplierId: parseInt(supplierId),
                notes,
                terms,
                status: "draft",
                totalAmount: 0,
            },
            include: { supplier: true },
        });

        return NextResponse.json(purchaseOrder, { status: 201 });
    } catch (error) {
        console.error("Error creating purchase order:", error);
        return NextResponse.json(
            { error: "Failed to create purchase order" },
            { status: 500 }
        );
    }
}
