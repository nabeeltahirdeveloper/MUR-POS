import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const units = await prisma.unit.findMany();
    return NextResponse.json(units);
}
