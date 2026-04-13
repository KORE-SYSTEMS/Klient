import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId, epicId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.order !== undefined) updateData.order = body.order;

    const epic = await prisma.epic.update({
      where: { id: epicId },
      data: updateData,
      include: { _count: { select: { tasks: true } } },
    });

    return NextResponse.json(epic);
  } catch (error) {
    console.error("Failed to update epic:", error);
    return NextResponse.json({ error: "Failed to update epic" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; epicId: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId, epicId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    // Unlink tasks from epic before deleting
    await prisma.task.updateMany({
      where: { epicId },
      data: { epicId: null },
    });

    await prisma.epic.delete({ where: { id: epicId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete epic:", error);
    return NextResponse.json({ error: "Failed to delete epic" }, { status: 500 });
  }
}
