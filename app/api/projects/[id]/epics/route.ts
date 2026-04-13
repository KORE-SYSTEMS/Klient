import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const epics = await prisma.epic.findMany({
    where: { projectId },
    include: { _count: { select: { tasks: true } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(epics);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const { title, description, color } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const maxOrder = await prisma.epic.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const epic = await prisma.epic.create({
      data: {
        title,
        description: description || null,
        color: color || "#6366f1",
        order: (maxOrder?.order ?? -1) + 1,
        projectId,
      },
      include: { _count: { select: { tasks: true } } },
    });

    return NextResponse.json(epic, { status: 201 });
  } catch (error) {
    console.error("Failed to create epic:", error);
    return NextResponse.json({ error: "Failed to create epic" }, { status: 500 });
  }
}
