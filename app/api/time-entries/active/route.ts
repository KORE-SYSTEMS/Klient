import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

// GET the currently active timer for the logged-in user
export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;

  const activeEntry = await prisma.timeEntry.findFirst({
    where: { userId, stoppedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true } },
      task: { select: { id: true, title: true, status: true, projectId: true } },
    },
  });

  return NextResponse.json(activeEntry);
}
