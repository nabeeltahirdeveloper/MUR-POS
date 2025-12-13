const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({});

async function main() {
    console.log('Starting seeding...');

    // Units
    const units = ['kg', 'inch', 'meter', 'piece', 'liter'];
    for (const name of units) {
        // Check if exists
        const exists = await prisma.unit.findFirst({ where: { name } });
        if (!exists) {
            await prisma.unit.create({ data: { name } });
        }
    }
    console.log('Seeded units');

    // Categories
    const categories = ['Electronics', 'Raw Material', 'Food'];
    for (const name of categories) {
        const exists = await prisma.category.findUnique({ where: { name } });
        if (!exists) {
            await prisma.category.create({ data: { name } });
        }
    }
    console.log('Seeded categories');

    // Ledger Categories
    const ledgerCategories = ['Salary', 'Utility Bills', 'Income'];
    for (const name of ledgerCategories) {
        const exists = await prisma.ledgerCategory.findUnique({ where: { name } });
        if (!exists) {
            await prisma.ledgerCategory.create({ data: { name } });
        }
    }
    console.log('Seeded ledger categories');

    // Suppliers
    const supplierCount = await prisma.supplier.count();
    if (supplierCount === 0) {
        await prisma.supplier.create({
            data: {
                name: 'Alpha Suppliers',
                phone: '123-456-7890',
                address: '123 Industrial Park',
            },
        });
        console.log('Seeded suppliers');
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
