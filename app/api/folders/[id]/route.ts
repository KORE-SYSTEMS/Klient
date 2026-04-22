import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const folder = await prisma.fileFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(folder.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json() as { name?: string; parentId?: string | null };
  const data: { name?: string; parentId?: string | null } = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    data.name = trimmed;
  }

  if ("parentId" in body) {
    // Prevent moving a folder into itself or its own descendant
    if (body.parentId === id) {
      return NextResponse.json({ error: "Cannot move folder into itself" }, { status: 400 });
    }
    data.parentId = body.parentId ?? null;
  }

  const updated = await prisma.fileFolder.update({
    where: { id },
    data,
    include: {
      _count: {
        select: { files: true, children: true },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const folder = await prisma.fileFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(folder.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Prisma cascade handles children folders and files via onDelete: Cascade
  await prisma.fileFolder.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
