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

  // Clients don't get folder navigation
  if (role === "CLIENT") {
    return NextResponse.json([]);
  }

  const parentIdParam = searchParams.get("parentId");
  const parentId = parentIdParam ?? null;

  const folders = await prisma.fileFolder.findMany({
    where: {
      projectId,
      parentId,
    },
    include: {
      _count: {
        select: { files: true, children: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(folders);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const body = await request.json() as { projectId?: string; name?: string; parentId?: string };
  const { projectId, name, parentId } = body;

  if (!projectId || !name?.trim()) {
    return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const folder = await prisma.fileFolder.create({
    data: {
      name: name.trim(),
      projectId,
      parentId: parentId ?? null,
      createdById: userId,
    },
    include: {
      _count: {
        select: { files: true, children: true },
      },
    },
  });

  return NextResponse.json(folder, { status: 201 });
}
