import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

/**
 * Checklist items ("sub-tasks") for a Task.
 *
 * Intentionally lightweight — no assignee/priority/status. If a checklist
 * item grows complex enough to need those, promote it to a real Task.
 *
 * Access model mirrors /api/tasks: ADMIN+MEMBER have full CRUD on tasks in
 * projects they have access to. Clients can toggle `done` only on items of
 * tasks they've been handed for approval, and otherwise only read items on
 * fully-visible tasks.
 */

async function loadTaskOrForbid(taskId: string, userId: string, role: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      clientVisible: true,
      assigneeId: true,
      approvalStatus: true,
    },
  });
  if (!task) return { error: NextResponse.json({ error: "Task not found" }, { status: 404 }) };

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(task.projectId, userId);
    if (!hasAccess) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { task };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id: taskId } = await params;
  const { task, error } = await loadTaskOrForbid(taskId, session.user.id, session.user.role);
  if (error) return error;

  const isClient = session.user.role === "CLIENT";
  if (isClient) {
    // Clients only see checklist for fully-visible tasks or tasks pending their approval
    const canSee =
      task!.clientVisible ||
      (task!.approvalStatus === "PENDING" && task!.assigneeId === session.user.id);
    if (!canSee) return NextResponse.json([]);
  }

  const items = await prisma.taskChecklistItem.findMany({
    where: { taskId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: taskId } = await params;
  const { error } = await loadTaskOrForbid(taskId, session.user.id, session.user.role);
  if (error) return error;

  try {
    const { title } = await request.json();
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    // Append at end: use current max+1 so items stay in insertion order without
    // rewriting existing rows.
    const last = await prisma.taskChecklistItem.findFirst({
      where: { taskId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (last?.order ?? -1) + 1;

    const item = await prisma.taskChecklistItem.create({
      data: { taskId, title: title.trim(), order: nextOrder },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("Failed to create checklist item:", err);
    return NextResponse.json({ error: "Failed to create checklist item" }, { status: 500 });
  }
}
