const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Only create default workspace if none exists
  const workspaceCount = await prisma.workspace.count();
  if (workspaceCount === 0) {
    await prisma.workspace.create({
      data: {
        id: "default",
        name: "Klient",
        primaryColor: "#F5A623",
      },
    });
    console.log("Default workspace created.");
  } else {
    console.log("Workspace already exists, skipping seed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
