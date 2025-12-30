import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { queryDocs, getAllDocs, getDocById } from "@/lib/firestore-helpers";
import { calculateCurrentStock, checkLowStock } from "@/lib/inventory";
import { getReminderById, reminderDocId, upsertReminder } from "@/lib/reminders";
import type { FirestoreItem, FirestoreCategory, FirestoreUnit } from "@/types/firestore";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get("categoryId");
        const search = searchParams.get("search");

        let items: (FirestoreItem & { id: string })[];

        if (categoryId) {
            items = await queryDocs<FirestoreItem>('items', [
                { field: 'categoryId', operator: '==', value: categoryId }
            ], {
                orderBy: 'name',
                orderDirection: 'asc',
            });
        } else {
            items = await getAllDocs<FirestoreItem>('items', {
                orderBy: 'name',
                orderDirection: 'asc',
            });
        }

        // Filter by search term if provided (case-insensitive)
        if (search) {
            const searchLower = search.toLowerCase();
            items = items.filter(item => 
                item.name.toLowerCase().includes(searchLower)
            );
        }

        // Fetch related data (category, baseUnit, saleUnit)
        const itemsWithRelations = await Promise.all(
            items.map(async (item) => {
                const [category, baseUnit, saleUnit] = await Promise.all([
                    item.categoryId ? getDocById<FirestoreCategory>('categories', item.categoryId) : null,
                    item.baseUnitId ? getDocById<FirestoreUnit>('units', item.baseUnitId) : null,
                    item.saleUnitId ? getDocById<FirestoreUnit>('units', item.saleUnitId) : null,
                ]);

                const currentStock = await calculateCurrentStock(item.id);
                const isLowStock = await checkLowStock(item.id, currentStock);

                // Keep reminders consistent with the same low-stock flag the UI uses.
                // This also backfills reminders for already-low items without waiting for cron.
                if (isLowStock) {
                    const reminderId = reminderDocId("low_stock", item.id);
                    const existing = await getReminderById(reminderId);
                    if (!existing || existing.resolvedAt !== null || !existing.triggered) {
                        const min = Number(item.minStockLevel ?? 0);
                        await upsertReminder({
                            id: reminderId,
                            type: "low_stock",
                            source: { collection: "items", id: item.id },
                            title: `Low stock: ${item.name}`,
                            message: `Current stock is ${currentStock}. Minimum is ${min}.`,
                            triggerAt: new Date(),
                            triggered: true,
                            resolvedAt: null,
                        });
                    }
                }

                return {
                    ...item,
                    category,
                    baseUnit,
                    saleUnit,
                    currentStock,
                    isLowStock,
                };
            })
        );

        return NextResponse.json(itemsWithRelations);
    } catch (error) {
        console.error("Error fetching items:", error);
        return NextResponse.json(
            { error: "Failed to fetch items" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            categoryId,
            baseUnitId,
            saleUnitId,
            conversionFactor,
            minStockLevel,
            firstSalePrice,
            secondPurchasePrice,
        } = body;

        if (!name || !baseUnitId || !saleUnitId) {
            return NextResponse.json(
                { error: "Name, Base Unit, and Sale Unit are required" },
                { status: 400 }
            );
        }

        const itemData: Omit<FirestoreItem, 'id'> = {
            name,
            categoryId: categoryId || null,
            baseUnitId: baseUnitId || null,
            saleUnitId: saleUnitId || null,
            conversionFactor: conversionFactor ? Number(conversionFactor) : 1,
            minStockLevel: minStockLevel ? Number(minStockLevel) : 0,
            firstSalePrice: firstSalePrice !== undefined && firstSalePrice !== null ? Number(firstSalePrice) : null,
            secondPurchasePrice: secondPurchasePrice !== undefined && secondPurchasePrice !== null ? Number(secondPurchasePrice) : null,
            createdAt: new Date(),
        };

        const { createDoc, getDocById } = await import('@/lib/firestore-helpers');
        const itemId = await createDoc<Omit<FirestoreItem, 'id'>>('items', itemData);

        // Fetch the created item with relations
        const newItem = await getDocById<FirestoreItem>('items', itemId);
        if (!newItem) {
            throw new Error('Failed to fetch created item');
        }

        const [category, baseUnit, saleUnit] = await Promise.all([
            newItem.categoryId ? getDocById<FirestoreCategory>('categories', newItem.categoryId) : null,
            newItem.baseUnitId ? getDocById<FirestoreUnit>('units', newItem.baseUnitId) : null,
            newItem.saleUnitId ? getDocById<FirestoreUnit>('units', newItem.saleUnitId) : null,
        ]);

        return NextResponse.json({
            ...newItem,
            category,
            baseUnit,
            saleUnit,
        }, { status: 201 });
    } catch (error) {
        console.error("Error creating item:", error);
        return NextResponse.json(
            { error: "Failed to create item" },
            { status: 500 }
        );
    }
}
