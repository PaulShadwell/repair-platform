import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";

async function main(): Promise<void> {
  const adminRole = await prisma.role.upsert({
    where: { key: "ADMIN" },
    update: {},
    create: { key: "ADMIN" },
  });

  const repairerRole = await prisma.role.upsert({
    where: { key: "REPAIRER" },
    update: {},
    create: { key: "REPAIRER" },
  });
  const posRole = await prisma.role.upsert({
    where: { key: "POS_USER" },
    update: {},
    create: { key: "POS_USER" },
  });

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      fullName: "Administrator",
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  const posUser = await prisma.user.upsert({
    where: { username: "pos.demo" },
    update: {},
    create: {
      username: "pos.demo",
      fullName: "Demo POS User",
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: posUser.id,
        roleId: posRole.id,
      },
    },
    update: {},
    create: {
      userId: posUser.id,
      roleId: posRole.id,
    },
  });

  const repairerUser = await prisma.user.upsert({
    where: { username: "repairer.demo" },
    update: {},
    create: {
      username: "repairer.demo",
      fullName: "Demo Repairer",
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: repairerUser.id,
        roleId: repairerRole.id,
      },
    },
    update: {},
    create: {
      userId: repairerUser.id,
      roleId: repairerRole.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete: admin / repairer.demo / pos.demo (password: ChangeMe123!)");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
