const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  console.log('Prisma keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
  try {
    const keys = Object.keys(prisma);
    console.log('Is systemSetting present?', keys.includes('systemSetting'));
    console.log('Is SystemSetting present?', keys.includes('SystemSetting'));
  } catch (e) {
    console.error('Error debugging prisma:', e);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
