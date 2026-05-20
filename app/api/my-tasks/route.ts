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

  // Build base task-where. We resolve DONE statuses AFTER the initial fetch
  // so the filter scopes naturally to the user's projects (no global lookup).
  const taskWhere = {
    assigneeId: userId,
    project: isClient ? { members: { some: { userId } } } : undefined,
    ...(isClient ? { clientVisible: true } : {}),
    ...(Object.keys(dueDateFilter).length ? { dueDate: dueDateFilter } : {}),
  };

  // For "overdue" we need to exclude DONE-category tasks. Strategy: fetch
  // tasks, then filter client-side by status category. Avoids a global
  // TaskStatus lookup across all projects in the system.
  let tasks = await prisma.task.findMany({
    where: taskWhere,
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

  // Resolve status names + DONE-category info in ONE query per scope:
  // - statusIds:   status IDs actually referenced by the user's tasks
  // - projectIds:  projects the user has tasks in (for the doneStatusId lookup)
  // Both queries are scoped to data the user can already see — no global scan.
  const statusIds = Array.from(new Set(tasks.map((t) => t.status)));
  const projectIds = Array.from(new Set(tasks.map((t) => t.project.id)));

  const [statuses, doneStatuses] = await Promise.all([
    statusIds.length
      ? prisma.taskStatus.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, name: true, color: true, category: true, projectId: true },
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.taskStatus.findMany({
          where: { projectId: { in: projectIds }, category: "DONE" },
          select: { id: true, projectId: true, order: true },
          orderBy: { order: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));
  const doneByProject: Record<string, string> = {};
  for (const s of doneStatuses) {
    if (!doneByProject[s.projectId]) doneByProject[s.projectId] = s.id;
  }

  // Apply overdue's DONE-exclusion in memory (cheap — list is already user-scoped)
  if (dueFilter === "overdue") {
    tasks = tasks.filter((t) => statusMap[t.status]?.category !== "DONE");
  }

  const enriched = tasks.map((t) => ({
    ...t,
    statusName:  statusMap[t.status]?.name  || t.status,
    statusColor: statusMap[t.status]?.color || "#6b7280",
    isDone:      statusMap[t.status]?.category === "DONE",
    doneStatusId: doneByProject[t.project.id] || null,
  }));

  return NextResponse.json(enriched);
}
