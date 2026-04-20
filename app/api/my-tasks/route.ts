/**
 * GET /api/my-tasks
 *
 * Returns all tasks assigned to the current user across all accessible projects.
 * Supports optional query params:
 *   - status: filter by status id (comma-separated)
 *   - priority: filter by priority (comma-separated)
 *   - due: "overdue" | "today" | "week" | "none"
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId   = session.user.id;
  const isClient = session.user.role === "CLIENT";

  const { searchParams } = new URL(request.url);
  const dueFilter      = searchParams.get("due") || "";

  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow  = new Date(today.getTime() + 86_400_000);
  const weekLater = new Date(today.getTime() + 7 * 86_400_000);

  // Build dueDate filter
  let dueDateFilter: Record<string, unknown> = {};
  if (dueFilter === "overdue") dueDateFilter = { not: null, lt: today };
  if (dueFilter === "today")   dueDateFilter = { gte: today, lt: tomorrow };
  if (dueFilter === "week")    dueDateFilter = { gte: today, lt: weekLater };
  if (dueFilter === "none")    dueDateFilter = { equals: null };

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      project: isClient ? { members: { some: { userId } } } : undefined,
      ...(isClient ? { clientVisible: true } : {}),
      ...(Object.keys(dueDateFilter).length ? { dueDate: dueDateFilter } : {}),
    },
    include: {
      project:  { select: { id: true, name: true, color: true } },
      assignee: { select: { id: true, name: true, email: true, image: true } },
      epic:     { select: { id: true, title: true, color: true } },
    },
    orderBy: [
      { dueDate: "asc" },
      { priority: "asc" },
      { updatedAt: "desc" },
    ],
  });

  // Resolve status names from TaskStatus (tasks span multiple projects)
  const statusIds = Array.from(new Set(tasks.map((t) => t.status)));
  const statuses  = statusIds.length
    ? await prisma.taskStatus.findMany({
        where: { id: { in: statusIds } },
        select: { id: true, name: true, color: true },
      })
    : [];
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));

  const enriched = tasks.map((t) => ({
    ...t,
    statusName:  statusMap[t.status]?.name  || t.status,
    statusColor: statusMap[t.status]?.color || "#6b7280",
  }));

  return NextResponse.json(enriched);
}
