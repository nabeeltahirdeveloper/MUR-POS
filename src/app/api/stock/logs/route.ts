import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get("itemId");

        if (!itemId) {
            return NextResponse.json(
                { error: "Item ID is required" },
                { status: 400 }
            );
        }

        const logs = await prisma.stockLog.findMany({
            where: {
                itemId: parseInt(itemId),
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                item: {
                    select: {
                        name: true,
                        baseUnit: true,
                    }
                }
            }
        });

        return NextResponse.json(logs);
    } catch (error) {
        console.error("Error fetching stock logs:", error);
        return NextResponse.json(
            { error: "Failed to fetch stock logs" },
            { status: 500 }
        );
    }
}
