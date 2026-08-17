import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const counts = {
    reservations: await prisma.reservation.count(),
    payments: await prisma.payment.count(),
    guests: await prisma.guest.count(),
    enquiries: await prisma.enquiry.count(),
    rooms: await prisma.room.count(),
    holds: await prisma.reservationHold.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
    roomAssignments: await prisma.roomAssignment.count(),
    roomMovements: await prisma.roomMovement.count(),
    housekeepingTasks: await prisma.housekeepingTask.count(),
    maintenanceRecords: await prisma.maintenanceRecord.count(),
  };
  console.log("DB_COUNTS:", JSON.stringify(counts, null, 2));
  await prisma.$disconnect();
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});
