import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  // Check project access
  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(id, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const isClient = role === "CLIENT";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, image: true, company: true } },
        },
      },
      _count: {
        select: {
          tasks: isClient ? { where: { clientVisible: true } } : true,
          files: isClient ? { where: { clientVisible: true } } : true,
          updates: true,
          messages: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(id, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const { name, description, status, color, dueDate, memberIds, archived, hourlyRate, budget } = body;

    const updateData: Record<string, unknown> = {};
    if (name        !== undefined) updateData.name        = name;
    if (description !== undefined) updateData.description = description;
    if (status      !== undefined) updateData.status      = status;
    if (color       !== undefined) updateData.color       = color;
    if (dueDate     !== undefined) updateData.dueDate     = dueDate ? new Date(dueDate) : null;
    if (archived    !== undefined) updateData.archived    = archived;
    if (hourlyRate  !== undefined) updateData.hourlyRate  = hourlyRate !== null ? Number(hourlyRate) : null;
    if (budget      !== undefined) updateData.budget      = budget     !== null ? Number(budget)     : null;

    // If memberIds provided, replace all members
    if (memberIds !== undefined) {
      await prisma.projectMember.deleteMany({ where: { projectId: id } });
      await prisma.projectMember.createMany({
        data: memberIds.map((uid: string) => ({ userId: uid, projectId: id })),
      });
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, image: true } } },
        },
        _count: { select: { tasks: true, files: true, updates: true, messages: true } },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(id, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
