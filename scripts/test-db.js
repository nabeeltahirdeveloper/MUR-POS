const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Testing DB connection...');
    try {
        // Try to query something simple
        const userCount = await prisma.user.count();
        console.log(`User count: ${userCount}`);

        const unitCount = await prisma.unit.count();
        console.log(`Unit count: ${unitCount}`);

        console.log('DB connection successful!');
    } catch (e) {
        console.error('DB connection failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
