import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        const body = await request.json();
        const { name, phone, address } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const supplier = await prisma.supplier.update({
            where: { id },
            data: { name, phone, address },
        });

        return NextResponse.json(supplier);
    } catch (error) {
        console.error("Error updating supplier:", error);
        return NextResponse.json(
            { error: "Failed to update supplier" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);

        // Check for existing POs
        const poCount = await prisma.purchaseOrder.count({
            where: { supplierId: id },
        });

        if (poCount > 0) {
            return NextResponse.json(
                { error: "Cannot delete supplier with existing Purchase Orders" },
                { status: 400 }
            );
        }

        await prisma.supplier.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting supplier:", error);
        return NextResponse.json(
            { error: "Failed to delete supplier" },
            { status: 500 }
        );
    }
}
