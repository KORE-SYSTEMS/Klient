import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess } from "@/lib/auth-guard";
import { notifyMany } from "@/lib/notifications";

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

  const messages = await prisma.message.findMany({
    where: { projectId },
    include: {
      author: { select: { id: true, name: true, email: true, role: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { content, projectId, filePath, fileName } = body;

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

    const message = await prisma.message.create({
      data: {
        content,
        projectId,
        authorId: userId,
        filePath: filePath || undefined,
        fileName: fileName || undefined,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true, image: true } },
      },
    });

    // --- Notify project members (except author) ---
    const [project, members] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
      prisma.projectMember.findMany({ where: { projectId }, select: { userId: true } }),
    ]);
    const recipients = members.map((m) => m.userId).filter((uid) => uid !== userId);
    if (recipients.length > 0 && project) {
      const preview = String(content).trim().substring(0, 140);
      await notifyMany(recipients, {
        type: "CHAT_MESSAGE",
        title: `Neue Nachricht in ${project.name}`,
        message: `${message.author.name || message.author.email}: ${preview}`,
        link: `/projects/${projectId}/chat`,
        actorId: userId,
      });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Failed to create message:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}
