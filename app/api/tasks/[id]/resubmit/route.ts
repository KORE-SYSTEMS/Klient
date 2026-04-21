/**
 * POST /api/tasks/[id]/resubmit
 *
 * Team (ADMIN/MEMBER) endpoint to re-open a rejected approval task so the
 * client can review again after revisions. Resets the approval state back to
 * PENDING, clears the previous decision metadata, keeps the (optionally new)
 * assignee, and notifies the client.
 *
 * Body: { comment?: string, assigneeId?: string }
 *   - comment:    optional hand-off comment describing the fixes
 *   - assigneeId: optional new client assignee (fallback: previous approvedById
 *                 or current assignee)
 *
 * Validates:
 *  - Caller is ADMIN or MEMBER
 *  - Task.approvalStatus === "REJECTED"
 *  - Caller has access to the project
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { notify } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(task.projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (task.approvalStatus !== "REJECTED") {
    return NextResponse.json(
      { error: "Only rejected approvals can be resubmitted" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { comment, assigneeId } = body as { comment?: string; assigneeId?: string };

  // Pick the new client reviewer: explicit body override → previous approver →
  // current assignee. If none resolves we leave it untouched (PATCH can fix it).
  const nextAssignee = assigneeId || task.approvedById || task.assigneeId || null;

  const updated = await prisma.task.update({
    where: { id },
    data: {
      approvalStatus: "PENDING",
      approvalComment: null,
      approvedAt: null,
      approvedById: null,
      handoffComment: comment ?? task.handoffComment,
      assigneeId: nextAssignee,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      epic: { select: { id: true, title: true, color: true } },
      sourceLinks: { include: { targetTask: { select: { id: true, title: true, status: true } } } },
      targetLinks: { include: { sourceTask: { select: { id: true, title: true, status: true } } } },
    },
  });

  await prisma.taskActivity.create({
    data: {
      type: "APPROVAL_RESUBMITTED",
      taskId: id,
      userId,
      newValue: comment || null,
    },
  });

  // Notify the client reviewer that the task is back in their court
  if (nextAssignee && nextAssignee !== userId) {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    await notify({
      userId: nextAssignee,
      type: "TASK_STATUS_CHANGED",
      title: `Erneut zur Abnahme: ${task.title}`,
      message:
        `${actor?.name || actor?.email || "Das Team"} hat den Task überarbeitet und erneut zur Abnahme eingereicht.` +
        (comment ? ` Kommentar: "${comment}"` : ""),
      link: `/projects/${task.projectId}/tasks?task=${id}`,
      actorId: userId,
    });
  }

  return NextResponse.json({ ...updated, _isPreview: false });
}
