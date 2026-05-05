const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: 'test@mur.com' } });
  if (!user) { console.log('NOT FOUND'); }
  else {
    console.log('FOUND:');
    console.log('  id:           ', user.id);
    console.log('  email:        ', user.email);
    console.log('  name:         ', user.name);
    console.log('  role:         ', user.role);
    console.log('  passwordHash: ', user.passwordHash.slice(0, 20) + '...');
    console.log('  createdAt:    ', user.createdAt);
  }
  await prisma.$disconnect();
})();
