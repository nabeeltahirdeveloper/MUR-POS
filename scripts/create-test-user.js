const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const EMAIL = 'test@mur.com';
const PASSWORD = 'Test@123';
const NAME = 'Test User';
const ROLE = 'admin';

async function main() {
    const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    if (existing) {
        const updated = await prisma.user.update({
            where: { email: EMAIL },
            data: { passwordHash, name: NAME, role: ROLE },
        });
        console.log(`Updated existing user: ${updated.email} (id=${updated.id})`);
    } else {
        const created = await prisma.user.create({
            data: { email: EMAIL, name: NAME, role: ROLE, passwordHash },
        });
        console.log(`Created new user: ${created.email} (id=${created.id})`);
    }

    console.log(`\nLogin credentials:`);
    console.log(`  Email:    ${EMAIL}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log(`  Role:     ${ROLE}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
