import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

/**
 * Per-item checklist endpoints.
 *
 * PATCH — toggle `done`, rename, or reorder a checklist item.
 *   Clients may ONLY toggle `done` (and only on fully-visible tasks or tasks
 *   pending their approval). Any other field change from a client is ignored.
 * DELETE — remove the item. Admin/member only.
 */

async function loadCtx(taskId: string, itemId: string, userId: string, role: string) {
  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: itemId },
    include: {
      task: {
        select: {
          id: true,
          projectId: true,
          clientVisible: true,
          assigneeId: true,
          approvalStatus: true,
        },
      },
    },
  });
  if (!item || item.taskId !== taskId) {
    return { error: NextResponse.json({ error: "Checklist item not found" }, { status: 404 }) };
  }

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(item.task.projectId, userId);
    if (!hasAccess) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }
  return { item };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id: taskId, itemId } = await params;
  const { item, error } = await loadCtx(taskId, itemId, session.user.id, session.user.role);
  if (error) return error;

  const isClient = session.user.role === "CLIENT";

  try {
    const body = await request.json();
    const data: { done?: boolean; title?: string; order?: number } = {};

    if (isClient) {
      // Clients may only toggle done, and only when they'd have seen the item at all
      const canSee =
        item!.task.clientVisible ||
        (item!.task.approvalStatus === "PENDING" && item!.task.assigneeId === session.user.id);
      if (!canSee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (typeof body.done === "boolean") data.done = body.done;
    } else {
      if (typeof body.done === "boolean") data.done = body.done;
      if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
      if (typeof body.order === "number") data.order = body.order;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const updated = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update checklist item:", err);
    return NextResponse.json({ error: "Failed to update checklist item" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: taskId, itemId } = await params;
  const { error } = await loadCtx(taskId, itemId, session.user.id, session.user.role);
  if (error) return error;

  try {
    await prisma.taskChecklistItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete checklist item:", err);
    return NextResponse.json({ error: "Failed to delete checklist item" }, { status: 500 });
  }
}
