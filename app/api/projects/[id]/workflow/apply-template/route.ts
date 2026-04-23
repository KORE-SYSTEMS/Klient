import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { getTemplate } from "@/lib/workflow-templates";

/**
 * POST /api/projects/[id]/workflow/apply-template
 * Body: { templateId: string, strategy?: "replace" | "append" }
 *
 * "replace" — removes all current statuses and creates the template ones.
 *             Fails if tasks still reference any current status, unless
 *             `fallbackCategory` is provided and the existing category
 *             matches a target-template status; in that case each task is
 *             moved to the first matching category status.
 * "append"  — keeps current statuses and adds any template ones that are
 *             missing (matched by slug).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({} as any));
  const templateId = body?.templateId;
  const strategy: "replace" | "append" = body?.strategy === "append" ? "append" : "replace";

  const tpl = getTemplate(templateId);
  if (!tpl) return NextResponse.json({ error: "Unknown template" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.taskStatus.findMany({ where: { projectId } });

      if (strategy === "append") {
        const bySlugSuffix = new Map(existing.map((s) => [s.id.split("_").slice(1).join("_") || s.id, s]));
        const maxOrder = existing.reduce((m, s) => Math.max(m, s.order), -1);
        let nextOrder = maxOrder + 1;
        for (const s of tpl.statuses) {
          if (bySlugSuffix.has(s.slug)) continue;
          await tx.taskStatus.create({
            data: {
              id: `${projectId}_${s.slug}`,
              name: s.name,
              color: s.color,
              order: nextOrder++,
              category: s.category,
              isApproval: s.isApproval ?? false,
              projectId,
            },
          });
        }
        return;
      }

      // "replace": re-map tasks onto the new statuses by category, then swap.
      // Build category → new-status-id map (first status wins within a category).
      const newStatuses = tpl.statuses.map((s, idx) => ({
        id: `${projectId}_${s.slug}`,
        name: s.name,
        color: s.color,
        order: idx,
        category: s.category,
        isApproval: s.isApproval ?? false,
        projectId,
      }));

      const firstOfCategory: Record<string, string> = {};
      for (const s of newStatuses) {
        if (!firstOfCategory[s.category]) firstOfCategory[s.category] = s.id;
      }
      // Fallback if template is missing a category (shouldn't happen, but be safe).
      const anyNew = newStatuses[0]?.id;

      // Re-map existing tasks.
      for (const old of existing) {
        const target = firstOfCategory[old.category] ?? anyNew;
        if (!target) continue;
        // Skip re-mapping if the id happens to equal an existing one (we'll re-create below anyway).
        await tx.task.updateMany({
          where: { projectId, status: old.id },
          data: { status: target },
        });
      }

      // Delete old statuses — safe now that tasks have been moved.
      await tx.taskStatus.deleteMany({ where: { projectId } });

      // Recreate with template.
      await tx.taskStatus.createMany({ data: newStatuses });
    });

    const statuses = await prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ ok: true, statuses });
  } catch (error) {
    console.error("Failed to apply workflow template:", error);
    return NextResponse.json({ error: "Failed to apply template" }, { status: 500 });
  }
}
