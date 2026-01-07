export interface Unit {
    id: string;
    name: string;
    symbol?: string;
}

export interface Category {
    id: string;
    name: string;
}

export interface Item {
    id: string;
    name: string;
    categoryId: string | null;
    baseUnitId: string | null;
    saleUnitId: string | null;
    conversionFactor: number;
    minStockLevel: number | null;
    firstSalePrice?: number | null;
    secondPurchasePrice?: number | null;
    supplierId?: string | null;
    orderNumber?: number | null;
    image?: string | null;
    description?: string | null;
    createdAt: string;

    category?: Category;
    baseUnit?: Unit;
    saleUnit?: Unit;
    supplier?: { id: string; name: string };

    currentStock?: number; // Calculated field
    isLowStock?: boolean;
}

export interface StockLog {
    id: string;
    itemId: string;
    type: "in" | "out";
    quantityBaseUnit: number;
    description: string | null;
    createdAt: string;
    item?: {
        name: string;
        baseUnit: Unit;
    }
}
