import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

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
    where: {
      projectId,
      ...(isClient ? { clientVisible: true } : {}),
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
      timeEntries: {
        select: { id: true, duration: true, startedAt: true, stoppedAt: true, userId: true },
        orderBy: { startedAt: "desc" },
      },
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  // Add totalTime and activeTimer to each task
  const tasksWithTime = tasks.map((task) => {
    const totalTime = task.timeEntries.reduce((sum, e) => {
      if (e.stoppedAt) return sum + e.duration;
      // For running entries, calc live duration
      return sum + Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 1000);
    }, 0);
    const activeEntry = task.timeEntries.find((e) => !e.stoppedAt) || null;
    return { ...task, totalTime, activeEntry };
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

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || "BACKLOG",
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

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
