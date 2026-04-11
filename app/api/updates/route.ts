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

  const updates = await prisma.update.findMany({
    where: { projectId },
    include: {
      author: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(updates);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { content, type, projectId } = body;

    if (!content || !projectId) {
      return NextResponse.json({ error: "Content and projectId are required" }, { status: 400 });
    }

    const userId = session.user.id;
    const role = session.user.role;

    if (role !== "ADMIN") {
      const hasAccess = await requireProjectAccess(projectId, userId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const update = await prisma.update.create({
      data: {
        content,
        type: type || undefined,
        projectId,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true, image: true } },
      },
    });

    return NextResponse.json(update, { status: 201 });
  } catch (error) {
    console.error("Failed to create update:", error);
    return NextResponse.json({ error: "Failed to create update" }, { status: 500 });
  }
}
