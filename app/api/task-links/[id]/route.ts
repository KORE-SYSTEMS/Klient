import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, canAccessProjectRecord, forbidden } from "@/lib/auth-guard";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const link = await prisma.taskLink.findUnique({
    where: { id },
    select: {
      sourceTask: { select: { projectId: true } },
      targetTask: { select: { projectId: true } },
    },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  for (const t of [link.sourceTask, link.targetTask]) {
    if (!(await canAccessProjectRecord(session, t.projectId))) return forbidden();
  }

  try {
    await prisma.taskLink.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task link:", error);
    return NextResponse.json({ error: "Failed to delete task link" }, { status: 500 });
  }
}
