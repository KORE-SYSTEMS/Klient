import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

/** Update a single template. Admin/member only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> },
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId, templateId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const allowed: Record<string, unknown> = {};
    if (typeof body.name === "string") allowed.name = body.name.trim();
    if (typeof body.title === "string") allowed.title = body.title.trim();
    if ("description" in body) allowed.description = body.description ?? null;
    if (typeof body.priority === "string") allowed.priority = body.priority;
    if ("statusId" in body) allowed.statusId = body.statusId ?? null;
    if ("epicId" in body) allowed.epicId = body.epicId ?? null;
    if (Array.isArray(body.subtaskTitles)) {
      const normalized = body.subtaskTitles.filter(
        (s: unknown) => typeof s === "string" && s.trim().length > 0,
      );
      allowed.subtaskTitles = JSON.stringify(normalized);
    }

    const updated = await prisma.taskTemplate.update({
      where: { id: templateId, projectId },
      data: allowed,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

/** Delete a template. Admin/member only. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> },
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId, templateId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.taskTemplate.delete({ where: { id: templateId, projectId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
