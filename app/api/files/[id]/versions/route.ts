import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(file.projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (role === "CLIENT" && !file.clientVisible) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const versions = await prisma.fileVersion.findMany({
    where: { fileId: id },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { version: "desc" },
  });

  return NextResponse.json(versions);
}

export async function POST(
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
    const formData = await request.formData();
    const uploadedFile = formData.get("file") as File | null;
    const note = formData.get("note") as string | null;

    if (!uploadedFile) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    // Get current highest version number
    const latestVersion = await prisma.fileVersion.findFirst({
      where: { fileId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Save file to disk
    const uploadDir = path.join(process.cwd(), "uploads", file.projectId);
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    const bytes = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create the version record
    await prisma.fileVersion.create({
      data: {
        fileId: id,
        version: nextVersion,
        path: filePath,
        size: buffer.length,
        note: note?.trim() || null,
        uploadedById: userId,
        createdAt: new Date(),
      },
    });

    // Update the parent File to reflect the new "current" version
    const updatedFile = await prisma.file.update({
      where: { id },
      data: {
        name: uploadedFile.name,
        path: filePath,
        size: buffer.length,
        mimeType: uploadedFile.type || "application/octet-stream",
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        versions: {
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { version: "desc" },
        },
      },
    });

    return NextResponse.json(updatedFile, { status: 201 });
  } catch (error) {
    console.error("Failed to upload version:", error);
    return NextResponse.json({ error: "Failed to upload version" }, { status: 500 });
  }
}
