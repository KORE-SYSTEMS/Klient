import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const hashedPassword = await hash("changeme123", 12);

  await prisma.user.create({
    data: {
      email: "admin@klient.local",
      name: "Admin",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.workspace.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Klient",
      primaryColor: "#E8520A",
    },
  });

  console.log("Seed completed: admin@klient.local / changeme123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
