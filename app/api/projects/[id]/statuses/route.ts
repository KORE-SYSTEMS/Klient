import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

const DEFAULT_STATUSES = [
  { id: "BACKLOG", name: "Backlog", color: "#6b7280", order: 0 },
  { id: "TODO", name: "To Do", color: "#3b82f6", order: 1 },
  { id: "IN_PROGRESS", name: "In Arbeit", color: "#f97316", order: 2 },
  { id: "IN_REVIEW", name: "In Review", color: "#eab308", order: 3 },
  { id: "DONE", name: "Erledigt", color: "#10b981", order: 4 },
];

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

  let statuses = await prisma.taskStatus.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
  });

  // Auto-create default statuses if none exist
  if (statuses.length === 0) {
    await prisma.taskStatus.createMany({
      data: DEFAULT_STATUSES.map((s) => ({ ...s, projectId })),
    });
    statuses = await prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
  }

  return NextResponse.json(statuses);
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
    const { name, color } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get max order
    const maxOrder = await prisma.taskStatus.findFirst({
      where: { projectId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const status = await prisma.taskStatus.create({
      data: {
        id,
        name,
        color: color || "#6b7280",
        order: (maxOrder?.order ?? -1) + 1,
        projectId,
      },
    });

    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    console.error("Failed to create status:", error);
    return NextResponse.json({ error: "Failed to create status" }, { status: 500 });
  }
}
