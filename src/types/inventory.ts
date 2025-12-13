import { Prisma } from "@prisma/client";

export interface Unit {
    id: number;
    name: string;
    symbol?: string;
}

export interface Category {
    id: number;
    name: string;
}

export interface Item {
    id: number;
    name: string;
    categoryId: number | null;
    baseUnitId: number | null;
    saleUnitId: number | null;
    conversionFactor: number | Prisma.Decimal;
    minStockLevel: number | Prisma.Decimal | null;
    createdAt: string;

    category?: Category;
    baseUnit?: Unit;
    saleUnit?: Unit;

    currentStock?: number | Prisma.Decimal; // Calculated field
    isLowStock?: boolean;
}

export interface StockLog {
    id: number;
    itemId: number;
    type: "in" | "out";
    quantityBaseUnit: number | Prisma.Decimal;
    description: string | null;
    createdAt: string;
    item?: {
        name: string;
        baseUnit: Unit;
    }
}
