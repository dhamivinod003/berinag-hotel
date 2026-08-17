import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetDashboard() {
  console.log("Starting full dashboard & transactional data reset...");

  // Delete all child and transactional records in correct foreign key order
  const delHk = await prisma.housekeepingTask.deleteMany({});
  console.log(`Deleted ${delHk.count} housekeeping tasks.`);

  const delMaint = await prisma.maintenanceRecord.deleteMany({});
  console.log(`Deleted ${delMaint.count} maintenance records.`);

  const delRoomMovements = await prisma.roomMovement.deleteMany({});
  console.log(`Deleted ${delRoomMovements.count} room movements.`);

  const delRoomAssignments = await prisma.roomAssignment.deleteMany({});
  console.log(`Deleted ${delRoomAssignments.count} room assignments.`);

  const delBookingNotes = await prisma.bookingNote.deleteMany({});
  console.log(`Deleted ${delBookingNotes.count} booking notes.`);

  const delResEvents = await prisma.reservationEvent.deleteMany({});
  console.log(`Deleted ${delResEvents.count} reservation events.`);

  const delExtRequests = await prisma.extensionRequest.deleteMany({});
  console.log(`Deleted ${delExtRequests.count} extension requests.`);

  const delPayments = await prisma.payment.deleteMany({});
  console.log(`Deleted ${delPayments.count} payments.`);

  const delHolds = await prisma.reservationHold.deleteMany({});
  console.log(`Deleted ${delHolds.count} reservation holds.`);

  const delReservations = await prisma.reservation.deleteMany({});
  console.log(`Deleted ${delReservations.count} reservations.`);

  const delEnquiryNotes = await prisma.enquiryNote.deleteMany({});
  console.log(`Deleted ${delEnquiryNotes.count} enquiry notes.`);

  const delEnquiries = await prisma.enquiry.deleteMany({});
  console.log(`Deleted ${delEnquiries.count} enquiries.`);

  const delGuests = await prisma.guest.deleteMany({});
  console.log(`Deleted ${delGuests.count} guests.`);

  const delNotifications = await prisma.notification.deleteMany({});
  console.log(`Deleted ${delNotifications.count} notifications.`);

  const delAuditLogs = await prisma.auditLog.deleteMany({});
  console.log(`Deleted ${delAuditLogs.count} audit logs.`);

  // Reset all physical rooms back to READY and active
  const updatedRooms = await prisma.room.updateMany({
    data: {
      status: "READY",
      notes: null,
      isActive: true,
    },
  });
  console.log(`Reset status to READY for ${updatedRooms.count} physical rooms.`);

  // Ensure staff accounts are unlocked with Admin@123
  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.default.hash("Admin@123", 12);
  await prisma.staff.updateMany({
    data: {
      passwordHash: hash,
      failedLoginCount: 0,
      lockedUntil: null,
      status: "ACTIVE",
    },
  });
  console.log("Staff accounts unlocked and password set to: Admin@123");

  // Verify counts
  const finalCounts = {
    totalBookings: await prisma.reservation.count(),
    activeHolds: await prisma.reservationHold.count(),
    payments: await prisma.payment.count(),
    guests: await prisma.guest.count(),
    enquiries: await prisma.enquiry.count(),
    housekeepingTasks: await prisma.housekeepingTask.count(),
    maintenanceRecords: await prisma.maintenanceRecord.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
    totalRooms: await prisma.room.count(),
    readyRooms: await prisma.room.count({ where: { status: "READY" } }),
    occupiedRooms: await prisma.room.count({ where: { status: "OCCUPIED" } }),
  };

  console.log("\n=========================================");
  console.log("DASHBOARD RESET COMPLETE! Current counts:");
  console.log(JSON.stringify(finalCounts, null, 2));
  console.log("=========================================\n");

  await prisma.$disconnect();
}

resetDashboard().catch((err) => {
  console.error("Error during reset:", err);
  process.exit(1);
});
