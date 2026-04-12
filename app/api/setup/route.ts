import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

// GET: Check if setup is needed (no admin user exists)
export async function GET() {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  return NextResponse.json({ setupNeeded: adminCount === 0 });
}

// POST: Create the initial admin user and workspace
export async function POST(request: Request) {
  // Only allow setup if no admin exists yet
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) {
    return NextResponse.json(
      { error: "Setup wurde bereits durchgeführt" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { email, password, name, workspaceName } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "E-Mail und Passwort sind erforderlich" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Passwort muss mindestens 8 Zeichen lang sein" },
      { status: 400 }
    );
  }

  const hashedPassword = await hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name: name || "Admin",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  await prisma.workspace.upsert({
    where: { id: "default" },
    update: { name: workspaceName || "Klient" },
    create: {
      id: "default",
      name: workspaceName || "Klient",
      primaryColor: "#F5A623",
    },
  });

  return NextResponse.json({ success: true });
}
