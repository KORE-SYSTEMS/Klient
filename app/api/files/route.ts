import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const clientVisible = formData.get("clientVisible") === "true";

    if (!file || !projectId) {
      return NextResponse.json({ error: "File and projectId are required" }, { status: 400 });
    }

    const userId = session.user.id;
    const role = session.user.role;

    if (role !== "ADMIN") {
      const hasAccess = await requireProjectAccess(projectId, userId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), "uploads", projectId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename to prevent collisions
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save file record in database
    const fileRecord = await prisma.file.create({
      data: {
        name: file.name,
        path: filePath,
        size: buffer.length,
        mimeType: file.type || "application/octet-stream",
        clientVisible,
        projectId,
        uploadedById: userId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json(fileRecord, { status: 201 });
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
