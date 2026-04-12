import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { readFile, unlink } from "fs/promises";
import { existsSync } from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  // Check project access
  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(file.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Clients can only access client-visible files
  if (role === "CLIENT" && !file.clientVisible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read file from disk
  if (!existsSync(file.path)) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  try {
    const buffer = await readFile(file.path);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Failed to read file:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const updated = await prisma.file.update({
    where: { id },
    data: { clientVisible: body.clientVisible },
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

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(file.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    // Delete file from disk
    if (existsSync(file.path)) {
      await unlink(file.path);
    }

    // Delete database record
    await prisma.file.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
