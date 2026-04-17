/**
 * POST /api/tasks/[id]/approve
 *
 * Client-only endpoint to approve or reject an approval task.
 * Body: { decision: "APPROVED" | "REJECTED", comment?: string }
 *
 * Validates:
 *  - Caller is CLIENT
 *  - Task has approvalStatus === "PENDING"
 *  - Task is assigned to this client
 *
 * On success:
 *  - Updates task: approvalStatus, approvalComment, approvedAt, approvedById
 *  - If APPROVED: resets assigneeId (unassigns) so team reclaims it
 *  - Notifies all ADMIN/MEMBER project members
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess } from "@/lib/auth-guard";
import { notify } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "CLIENT") {
    return NextResponse.json({ error: "Only clients can use this endpoint" }, { status: 403 });
  }

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Verify access
  const hasAccess = await requireProjectAccess(task.projectId, userId);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Validate approval state
  if (task.approvalStatus !== "PENDING") {
    return NextResponse.json({ error: "Task is not pending approval" }, { status: 400 });
  }
  if (task.assigneeId !== userId) {
    return NextResponse.json({ error: "This approval is not assigned to you" }, { status: 403 });
  }

  const body = await request.json();
  const { decision, comment } = body as { decision: "APPROVED" | "REJECTED"; comment?: string };

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const now = new Date();
  const updated = await prisma.task.update({
    where: { id },
    data: {
      approvalStatus: decision,
      approvalComment: comment || null,
      approvedAt: now,
      approvedById: userId,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      epic: { select: { id: true, title: true, color: true } },
      sourceLinks: { include: { targetTask: { select: { id: true, title: true, status: true } } } },
      targetLinks: { include: { sourceTask: { select: { id: true, title: true, status: true } } } },
    },
  });

  // Record activity
  await prisma.taskActivity.create({
    data: {
      type: decision === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      taskId: id,
      userId,
      newValue: comment || null,
    },
  });

  // Notify all ADMIN/MEMBER project members
  const clientUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const clientName = clientUser?.name || clientUser?.email || "Kunde";

  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId: task.projectId },
    include: { user: { select: { id: true, role: true } } },
  });

  const link = `/projects/${task.projectId}/tasks?task=${id}`;
  const isApproved = decision === "APPROVED";
  const notifTitle = isApproved
    ? `✓ Abgenommen: ${task.title}`
    : `✗ Abgelehnt: ${task.title}`;
  const notifMessage = isApproved
    ? `${clientName} hat den Task genehmigt.${comment ? ` Kommentar: "${comment}"` : ""}`
    : `${clientName} hat den Task abgelehnt.${comment ? ` Kommentar: "${comment}"` : ""}`;

  for (const member of projectMembers) {
    if (member.user.role !== "CLIENT" && member.user.id !== userId) {
      await notify({
        userId: member.user.id,
        type: "TASK_STATUS_CHANGED",
        title: notifTitle,
        message: notifMessage,
        link,
        actorId: userId,
      });
    }
  }

  return NextResponse.json({ ...updated, _isPreview: false });
}
