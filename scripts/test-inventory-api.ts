import { prisma } from "../src/lib/prisma";
import { calculateCurrentStock, checkLowStock } from "../src/lib/inventory";
import { Prisma } from "@prisma/client";

async function main() {
    console.log("Starting Inventory Test...");

    // 1. Setup Data
    console.log("Creating Setup Data...");

    // Create units if not exist
    let kg = await prisma.unit.findFirst({ where: { name: "Kilogram" } });
    if (!kg) kg = await prisma.unit.create({ data: { name: "Kilogram", symbol: "kg" } });

    let item = await prisma.item.create({
        data: {
            name: "Test Wire " + Date.now(),
            baseUnitId: kg.id,
            saleUnitId: kg.id,
            minStockLevel: 10,
        },
    });
    console.log("Created Item:", item.id, item.name);

    // 2. Test Initial Stock
    let stock = await calculateCurrentStock(item.id);
    console.log("Initial Stock (should be 0):", stock.toString());

    // 3. Test Add Stock
    console.log("Adding Stock (50)...");
    await prisma.stockLog.create({
        data: {
            itemId: item.id,
            type: "in",
            quantityBaseUnit: 50,
            description: "Initial Stock",
        },
    });

    stock = await calculateCurrentStock(item.id);
    console.log("Stock after Add (should be 50):", stock.toString());

    // 4. Test Remove Stock
    console.log("Removing Stock (20)...");
    await prisma.stockLog.create({
        data: {
            itemId: item.id,
            type: "out",
            quantityBaseUnit: 20,
            description: "Used for project",
        },
    });

    stock = await calculateCurrentStock(item.id);
    console.log("Stock after Remove (should be 30):", stock.toString());

    // 5. Test Low Stock
    let isLow = await checkLowStock(item.id, stock);
    console.log(`Is Low Stock (30 <= 10)? ${isLow} (Expected: false)`);

    console.log("Removing Stock (25)... to trigger low stock");
    await prisma.stockLog.create({
        data: {
            itemId: item.id,
            type: "out",
            quantityBaseUnit: 25,
            description: "Low stock trigger",
        },
    });

    stock = await calculateCurrentStock(item.id); // 5 left
    isLow = await checkLowStock(item.id, stock);
    console.log(`Is Low Stock (5 <= 10)? ${isLow} (Expected: true)`);

    // Cleanup
    console.log("Cleaning up...");
    await prisma.stockLog.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
    console.log("Test Completed Successfully");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
