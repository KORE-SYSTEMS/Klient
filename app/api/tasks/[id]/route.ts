import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(task.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (role === "CLIENT") {
    if (!task.clientVisible) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (role === "CLIENT") {
      // Clients can NOT change status via drag or any other field
      // They can only interact via comments and file uploads
      return NextResponse.json({ error: "Clients cannot edit tasks" }, { status: 403 });
    } else {
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.priority !== undefined) updateData.priority = body.priority;
      if (body.clientVisible !== undefined) updateData.clientVisible = body.clientVisible;
      if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId || null;
      if (body.order !== undefined) updateData.order = body.order;
      if (body.epicId !== undefined) updateData.epicId = body.epicId || null;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
        epic: { select: { id: true, title: true, color: true } },
        sourceLinks: {
          include: {
            targetTask: { select: { id: true, title: true, status: true } },
          },
        },
        targetLinks: {
          include: {
            sourceTask: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    // Auto-create activity records for tracked changes
    const activities: { type: string; oldValue?: string; newValue?: string }[] = [];

    if (body.status !== undefined && body.status !== task.status) {
      activities.push({
        type: "STATUS_CHANGE",
        oldValue: task.status,
        newValue: body.status,
      });
    }
    if (body.priority !== undefined && body.priority !== task.priority) {
      activities.push({
        type: "PRIORITY_CHANGE",
        oldValue: task.priority,
        newValue: body.priority,
      });
    }
    if (body.assigneeId !== undefined && (body.assigneeId || null) !== task.assigneeId) {
      activities.push({
        type: "ASSIGNMENT",
        oldValue: task.assigneeId || undefined,
        newValue: body.assigneeId || undefined,
      });
    }

    if (activities.length > 0) {
      await prisma.taskActivity.createMany({
        data: activities.map((a) => ({
          type: a.type,
          taskId: id,
          userId,
          oldValue: a.oldValue || null,
          newValue: a.newValue || null,
        })),
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(task.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
