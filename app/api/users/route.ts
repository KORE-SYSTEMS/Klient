import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";

export async function GET() {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}
