import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess } from "@/lib/auth-guard";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

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

  const files = await prisma.file.findMany({
    where: { taskId },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(files);
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
    select: { projectId: true, clientVisible: true, assigneeId: true },
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

  // Clients can only upload files to tasks assigned to them
  if (role === "CLIENT") {
    if (task.assigneeId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const formData = await request.formData();
    const fileEntries = formData.getAll("files") as File[];

    if (fileEntries.length === 0) {
      return NextResponse.json({ error: "At least one file is required" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "uploads", task.projectId);
    await mkdir(uploadDir, { recursive: true });

    const results = [];

    for (const file of fileEntries) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${timestamp}-${safeName}`;
      const filePath = path.join(uploadDir, fileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      const fileRecord = await prisma.file.create({
        data: {
          name: file.name,
          path: filePath,
          size: buffer.length,
          mimeType: file.type || "application/octet-stream",
          clientVisible: true, // task files visible to anyone with task access
          projectId: task.projectId,
          taskId,
          uploadedById: userId,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      });

      results.push(fileRecord);

      // Create activity record
      await prisma.taskActivity.create({
        data: {
          type: "FILE_UPLOAD",
          taskId,
          userId,
          newValue: file.name,
        },
      });
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error("Failed to upload task file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  // Only admin/member or the uploader can delete
  if (role === "CLIENT" && file.uploadedById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (existsSync(file.path)) {
      await unlink(file.path);
    }
    await prisma.file.delete({ where: { id: fileId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
