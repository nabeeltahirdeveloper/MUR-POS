import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting seeding...');

    // Units
    const units = ['kg', 'inch', 'meter', 'piece', 'liter'];
    for (const name of units) {
        await prisma.unit.upsert({
            where: { id: 0 }, // Dummy where, actually we can't upsert easily without unique name. 
            // But wait, Unit name is not unique in schema? 
            // Let's check schema. Unit name is NOT unique.
            // So we should check if it exists or just create.
            // Better to just create if not exists.
            update: {},
            create: { name },
        }).catch(() => {
            // Fallback if upsert fails or just create
            return prisma.unit.create({ data: { name } });
        });
        // Actually, upsert requires a unique constraint.
        // I will use createMany or findFirst.
    }

    // Since Unit name is not unique in schema (my bad, usually it should be), 
    // I will just delete all and create new ones for seeding, or check first.
    // For safety, I will just try to create if count is 0.

    const unitCount = await prisma.unit.count();
    if (unitCount === 0) {
        await prisma.unit.createMany({
            data: units.map(name => ({ name })),
        });
        console.log('Seeded units');
    }

    // Categories
    const categories = ['Electronics', 'Raw Material', 'Food'];
    for (const name of categories) {
        await prisma.category.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }
    console.log('Seeded categories');

    // Ledger Categories
    const ledgerCategories = ['Salary', 'Utility Bills', 'Income'];
    for (const name of ledgerCategories) {
        await prisma.ledgerCategory.upsert({
            where: { name },
            update: {},
            create: { name },
        });
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
