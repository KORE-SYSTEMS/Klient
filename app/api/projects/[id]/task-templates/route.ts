import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

/** List all task-templates for a project. Members can see + use them. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.taskTemplate.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}

/** Create a new template. Admin/member only. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, title, description, priority, statusId, epicId, subtaskTitles } = body;

    if (!name?.trim() || !title?.trim()) {
      return NextResponse.json({ error: "Name und Titel sind Pflicht" }, { status: 400 });
    }

    // Defensive normalization for the JSON-encoded subtask titles
    const normalizedSubtasks = Array.isArray(subtaskTitles)
      ? subtaskTitles.filter((s: unknown) => typeof s === "string" && (s as string).trim().length > 0)
      : [];

    const template = await prisma.taskTemplate.create({
      data: {
        name: name.trim(),
        title: title.trim(),
        description: description || null,
        priority: priority || "MEDIUM",
        statusId: statusId || null,
        epicId: epicId || null,
        subtaskTitles: JSON.stringify(normalizedSubtasks),
        projectId,
      },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
