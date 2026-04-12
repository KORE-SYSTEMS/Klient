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

  // Check project access
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
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { title, description, status, priority, clientVisible, dueDate, projectId, assigneeId, order } = body;

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
        status: status || undefined,
        priority: priority || undefined,
        clientVisible: clientVisible ?? false,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        projectId,
        assigneeId: assigneeId || null,
        order: order ?? 0,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
