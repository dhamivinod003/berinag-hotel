import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const staffList = await prisma.staff.findMany();
  const hash = await bcrypt.hash("Admin@123", 12);
  
  for (const s of staffList) {
    await prisma.staff.update({
      where: { id: s.id },
      data: {
        passwordHash: hash,
        failedLoginCount: 0,
        lockedUntil: null,
        status: "ACTIVE"
      }
    });
  }
  console.log("Unlocked all staff accounts and updated passwords to: Admin@123");
  await prisma.$disconnect();
}

main().catch(console.error);
