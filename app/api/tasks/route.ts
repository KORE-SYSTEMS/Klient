import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { notify } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const isClient = role === "CLIENT";

  const tasks = await prisma.task.findMany({
    where: { projectId },
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
      timeEntries: {
        select: { id: true, duration: true, startedAt: true, stoppedAt: true, userId: true },
        orderBy: { startedAt: "desc" },
      },
      // Surfaced on kanban cards as small counter badges.
      // Clients only ever see full counts on fully-visible tasks (preview tasks
      // strip _count away in the mapping below), so no extra filter needed here.
      _count: {
        select: {
          comments: true,
          files: isClient ? { where: { clientVisible: true } } : true,
          checklistItems: true,
        },
      },
      checklistItems: { select: { done: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  // Add totalTime and activeTimer to each task
  const tasksWithTime = tasks.map((task) => {
    const totalTime = task.timeEntries.reduce((sum, e) => {
      if (e.stoppedAt) return sum + e.duration;
      return sum + Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 1000);
    }, 0);
    const activeEntry = task.timeEntries.find((e) => !e.stoppedAt) || null;
    const checklistDone = task.checklistItems.filter((c) => c.done).length;

    if (isClient) {
      // Full visibility: explicitly client-visible OR pending approval assigned to this client
      const isFullVisible =
        task.clientVisible ||
        (task.approvalStatus === "PENDING" && task.assigneeId === userId);

      if (!isFullVisible) {
        // Preview: only structural data — no sensitive details
        return {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          order: task.order,
          _isPreview: true,
        };
      }
    }

    // Strip raw checklistItems; expose derived counts only (callers who need
    // the full list hit /api/tasks/[id]/checklist).
    const { checklistItems: _omit, ...rest } = task;
    return {
      ...rest,
      totalTime,
      activeEntry,
      _isPreview: false,
      _count: { ...task._count, checklistDone },
    };
  });

  return NextResponse.json(tasksWithTime);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { title, description, status, priority, clientVisible, dueDate, projectId, assigneeId, order, epicId } = body;

    if (!title || !projectId) {
      return NextResponse.json({ error: "Title and projectId are required" }, { status: 400 });
    }

    const userId = session.user.id;
    const role = session.user.role;

    if (role !== "ADMIN") {
      const hasAccess = await requireProjectAccess(projectId, userId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Resolve a valid default status if none provided.
    // Task.status is a loose string reference to TaskStatus.id — using the
    // hardcoded "BACKLOG" breaks for projects whose statuses are project-scoped.
    let resolvedStatus: string = status;
    if (!resolvedStatus) {
      const first = await prisma.taskStatus.findFirst({
        where: { projectId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      resolvedStatus = first?.id ?? "BACKLOG";
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: resolvedStatus,
        priority: priority || "MEDIUM",
        clientVisible: clientVisible ?? false,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        projectId,
        assigneeId: assigneeId || null,
        order: order ?? 0,
        epicId: epicId || null,
      },
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

    // Create "CREATED" activity
    await prisma.taskActivity.create({
      data: {
        type: "CREATED",
        taskId: task.id,
        userId,
        newValue: title,
      },
    });

    // Notify initial assignee
    if (task.assigneeId && task.assigneeId !== userId) {
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      await notify({
        userId: task.assigneeId,
        type: "TASK_ASSIGNED",
        title: `Neuer Task zugewiesen: ${task.title}`,
        message: `${actor?.name || actor?.email || "Jemand"} hat dir den Task zugewiesen.`,
        link: `/projects/${task.projectId}/tasks?task=${task.id}`,
        actorId: userId,
      });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
