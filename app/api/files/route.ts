import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

  const folderId = searchParams.get("folderId");

  const where: {
    projectId: string;
    clientVisible?: boolean;
    folderId?: string | null;
  } = { projectId };

  if (role === "CLIENT") {
    where.clientVisible = true;
  }

  if (folderId !== null) {
    if (folderId === "root") {
      where.folderId = null;
    } else {
      where.folderId = folderId;
    }
  }
  // If no folderId param: return all files in project (backwards compat)

  const files = await prisma.file.findMany({
    where,
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(files);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  try {
    const formData = await request.formData();
    const projectId = formData.get("projectId") as string | null;
    const fileEntries = formData.getAll("files") as File[];

    if (!projectId || fileEntries.length === 0) {
      return NextResponse.json({ error: "projectId and at least one file are required" }, { status: 400 });
    }

    const userId = session.user.id;
    const role = session.user.role;

    if (role !== "ADMIN") {
      const hasAccess = await requireProjectAccess(projectId, userId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const uploadDir = path.join(process.cwd(), "uploads", projectId);
    await mkdir(uploadDir, { recursive: true });

    const folderIdValue = formData.get("folderId") as string | null;
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
          clientVisible: false,
          projectId,
          uploadedById: userId,
          folderId: folderIdValue || null,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { version: true },
          },
        },
      });

      results.push(fileRecord);
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error("Failed to upload file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
