import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);

        const purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: {
                    include: {
                        item: {
                            include: {
                                baseUnit: true, // Useful for showing unit
                            }
                        },
                    },
                    orderBy: { id: 'asc' }
                },
            },
        });

        if (!purchaseOrder) {
            return NextResponse.json(
                { error: "Purchase Order not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(purchaseOrder);
    } catch (error) {
        console.error("Error fetching purchase order:", error);
        return NextResponse.json(
            { error: "Failed to fetch purchase order" },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        const body = await request.json();
        const { supplierId, notes, terms } = body;

        const currentPO = await prisma.purchaseOrder.findUnique({
            where: { id },
        });

        if (!currentPO) {
            return NextResponse.json(
                { error: "Purchase Order not found" },
                { status: 404 }
            );
        }

        if (currentPO.status === "received" || currentPO.status === "cancelled") {
            return NextResponse.json(
                { error: "Cannot edit Purchase Order in final state" },
                { status: 400 }
            );
        }

        const data: any = { notes, terms };
        if (supplierId) data.supplierId = parseInt(supplierId);

        const updatedPO = await prisma.purchaseOrder.update({
            where: { id },
            data,
            include: { supplier: true },
        });

        return NextResponse.json(updatedPO);
    } catch (error) {
        console.error("Error updating purchase order:", error);
        return NextResponse.json(
            { error: "Failed to update purchase order" },
            { status: 500 }
        );
    }
}
