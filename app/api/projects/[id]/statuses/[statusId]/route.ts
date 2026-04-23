import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId, statusId } = await params;
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

    if (body.name !== undefined) updateData.name = body.name;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.isApproval !== undefined) updateData.isApproval = body.isApproval;
    if (body.category !== undefined) {
      const c = body.category;
      updateData.category = c === "TODO" || c === "IN_PROGRESS" || c === "DONE" ? c : "IN_PROGRESS";
    }

    const status = await prisma.taskStatus.update({
      where: { id: statusId },
      data: updateData,
    });

    return NextResponse.json(status);
  } catch (error) {
    console.error("Failed to update status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId, statusId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Check if any tasks use this status
  const taskCount = await prisma.task.count({
    where: { status: statusId, projectId },
  });

  if (taskCount > 0) {
    return NextResponse.json(
      { error: `Dieser Status wird noch von ${taskCount} Task(s) verwendet. Verschiebe die Tasks zuerst.` },
      { status: 400 }
    );
  }

  try {
    await prisma.taskStatus.delete({ where: { id: statusId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete status:", error);
    return NextResponse.json({ error: "Failed to delete status" }, { status: 500 });
  }
}
