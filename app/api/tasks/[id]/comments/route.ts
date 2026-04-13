import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, clientVisible: true },
  });
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

  if (role === "CLIENT" && !task.clientVisible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await prisma.taskComment.findMany({
    where: { taskId },
    include: {
      author: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, clientVisible: true, title: true, assigneeId: true },
  });
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

  // Clients can only comment on tasks assigned to them or client-visible tasks
  if (role === "CLIENT") {
    if (!task.clientVisible && task.assigneeId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const { content, mentions } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const mentionIds = Array.isArray(mentions) ? mentions : [];

    const comment = await prisma.taskComment.create({
      data: {
        content: content.trim(),
        taskId,
        authorId: userId,
        mentions: JSON.stringify(mentionIds),
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true, role: true } },
      },
    });

    // Create activity record
    await prisma.taskActivity.create({
      data: {
        type: "COMMENT",
        taskId,
        userId,
        newValue: content.trim().substring(0, 200),
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
