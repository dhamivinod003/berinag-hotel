const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const resort = await prisma.resort.findFirst();
  console.log('Resort: ' + resort.id);
  const reservations = await prisma.reservation.findMany({
    where: { resortId: resort.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { guest: { select: { fullName: true, email: true } } }
  });
  console.log('Recent reservations: ' + reservations.length);
  reservations.forEach(r => console.log(' - ' + r.bookingReference + ' by ' + r.guest.fullName + ' status=' + r.status));
  const total = await prisma.reservation.count({ where: { resortId: resort.id } });
  console.log('Total reservations: ' + total);
  await prisma.$disconnect();
})();
