import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { notify } from "@/lib/notifications";

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
    const isApprovalTask = task.approvalStatus === "PENDING" && task.assigneeId === userId;
    if (!task.clientVisible && !isApprovalTask) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (role === "CLIENT") {
      // Clients can only interact via comments and file uploads — not direct field edits
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
      // Approval workflow fields (set by staff during handoff)
      if (body.approvalStatus !== undefined) updateData.approvalStatus = body.approvalStatus;
      if (body.handoffComment !== undefined) updateData.handoffComment = body.handoffComment;
      if (body.approvalComment !== undefined) updateData.approvalComment = body.approvalComment;
      if (body.approvedAt !== undefined) updateData.approvedAt = body.approvedAt ? new Date(body.approvedAt) : null;
      if (body.approvedById !== undefined) updateData.approvedById = body.approvedById || null;
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

    // --- Notifications ---
    const link = `/projects/${task.projectId}/tasks?task=${id}`;
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const actorName = actor?.name || actor?.email || "Jemand";

    // New assignee
    const newAssigneeId = body.assigneeId !== undefined ? (body.assigneeId || null) : undefined;
    if (newAssigneeId !== undefined && newAssigneeId !== task.assigneeId && newAssigneeId) {
      await notify({
        userId: newAssigneeId,
        type: "TASK_ASSIGNED",
        title: `Neuer Task zugewiesen: ${updated.title}`,
        message: `${actorName} hat dir den Task zugewiesen.`,
        link,
        actorId: userId,
      });
    }

    // Status change → notify assignee (if not actor)
    if (body.status !== undefined && body.status !== task.status && updated.assigneeId && updated.assigneeId !== userId) {
      const oldStatus = await prisma.taskStatus.findUnique({ where: { id: task.status }, select: { name: true } });
      const newStatus = await prisma.taskStatus.findUnique({ where: { id: body.status }, select: { name: true } });
      await notify({
        userId: updated.assigneeId,
        type: "TASK_STATUS_CHANGED",
        title: `Status geändert: ${updated.title}`,
        message: `${actorName} hat den Status auf "${newStatus?.name || body.status}" geändert${oldStatus?.name ? ` (vorher: ${oldStatus.name})` : ""}.`,
        link,
        actorId: userId,
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
