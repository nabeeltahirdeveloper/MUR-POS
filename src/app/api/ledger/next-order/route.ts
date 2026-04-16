import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Atomic counter: increment and return in one operation
        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.systemSetting.findUnique({
                where: { key: "order_counter" }
            });

            if (existing) {
                const current = parseInt(JSON.parse(existing.value), 10);
                const next = current + 1;
                await tx.systemSetting.update({
                    where: { key: "order_counter" },
                    data: { value: JSON.stringify(next) }
                });
                return next;
            } else {
                // First time: find highest existing order number to initialize
                const maxEntry = await tx.ledger.findFirst({
                    where: { orderNumber: { not: null } },
                    orderBy: { orderNumber: "desc" }
                });
                const startFrom = (maxEntry?.orderNumber ?? 0) + 1;
                await tx.systemSetting.create({
                    data: { key: "order_counter", value: JSON.stringify(startFrom) }
                });
                return startFrom;
            }
        });

        return NextResponse.json({ nextOrderNumber: result });
    } catch (error) {
        console.error("Error fetching next order number:", error);
        return NextResponse.json(
            { error: "Failed to fetch next order number" },
            { status: 500 }
        );
    }
}
