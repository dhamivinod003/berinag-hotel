const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const notifs = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  console.log('Notifications: ' + notifs.length);
  notifs.forEach(n => console.log(' - [' + n.type + '] ' + n.title + ' @ ' + n.createdAt.toISOString()));
  const total = await prisma.notification.count();
  console.log('Total: ' + total);
  await prisma.$disconnect();
})();
