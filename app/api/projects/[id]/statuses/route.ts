import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { getTemplate, DEFAULT_TEMPLATE_ID } from "@/lib/workflow-templates";

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

  // Auto-create default workflow if none exist. Project-scoped IDs avoid
  // PK collisions when multiple projects are seeded.
  if (statuses.length === 0) {
    const tpl = getTemplate(DEFAULT_TEMPLATE_ID)!;
    await prisma.taskStatus.createMany({
      data: tpl.statuses.map((s, idx) => ({
        id: `${projectId}_${s.slug}`,
        name: s.name,
        color: s.color,
        order: idx,
        category: s.category,
        isApproval: s.isApproval ?? false,
        projectId,
      })),
    });

    // Back-fill any legacy tasks that still reference bare slugs.
    for (const s of tpl.statuses) {
      await prisma.task.updateMany({
        where: { projectId, status: s.slug },
        data: { status: `${projectId}_${s.slug}` },
      });
    }

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
    const { name, color, category } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const cat = normalizeCategory(category);

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
        isApproval: body.isApproval ?? false,
        category: cat,
        projectId,
      },
    });

    return NextResponse.json(status, { status: 201 });
  } catch (error) {
    console.error("Failed to create status:", error);
    return NextResponse.json({ error: "Failed to create status" }, { status: 500 });
  }
}

function normalizeCategory(value: unknown): "TODO" | "IN_PROGRESS" | "DONE" {
  if (value === "TODO" || value === "IN_PROGRESS" || value === "DONE") return value;
  return "IN_PROGRESS";
}
