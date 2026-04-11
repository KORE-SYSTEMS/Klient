import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const update = await prisma.update.findUnique({ where: { id } });
  if (!update) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  // Only the author or an admin can delete an update
  if (role !== "ADMIN" && update.authorId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(update.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await prisma.update.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete update:", error);
    return NextResponse.json({ error: "Failed to delete update" }, { status: 500 });
  }
}
