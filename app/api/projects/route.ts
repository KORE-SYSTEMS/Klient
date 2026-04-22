import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember } from "@/lib/auth-guard";

// Default task statuses that are seeded when a new project is created.
// Keep in sync with app/api/projects/[id]/statuses/route.ts
const DEFAULT_STATUSES = [
  { id: "BACKLOG",     name: "Backlog",   color: "#6b7280", order: 0 },
  { id: "TODO",        name: "To Do",     color: "#3b82f6", order: 1 },
  { id: "IN_PROGRESS", name: "In Arbeit", color: "#f97316", order: 2 },
  { id: "IN_REVIEW",   name: "In Review", color: "#eab308", order: 3 },
  { id: "DONE",        name: "Erledigt",  color: "#10b981", order: 4 },
];

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;
  const role = session.user.role;

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  // Base archived filter — unless explicitly requested, hide archived projects
  const archivedFilter = includeArchived ? {} : { archived: false };

  let projects;

  if (role === "ADMIN") {
    // Admins see all projects
    projects = await prisma.project.findMany({
      where: { ...archivedFilter },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, image: true } } },
        },
        _count: { select: { tasks: true, files: true, messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  } else if (role === "MEMBER") {
    // Members see projects they are assigned to
    projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
        ...archivedFilter,
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, image: true } } },
        },
        _count: { select: { tasks: true, files: true, messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  } else {
    // Clients only see their own (non-archived) projects
    projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
        ...archivedFilter,
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true, image: true } } },
        },
        _count: {
          select: {
            tasks: { where: { clientVisible: true } },
            files: { where: { clientVisible: true } },
            messages: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  const projectIds = projects.map((p) => p.id);

  // Enrich each project with a doneTaskCount.
  // "Done" = task whose status belongs to the highest-order TaskStatus of that project
  // (the rightmost column = the final/done column in any workflow).
  // Two extra queries total — not N.
  let doneCountMap: Record<string, number> = {};
  if (projectIds.length > 0) {
    // Get the max-order status id per project
    const allStatuses = await prisma.taskStatus.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, projectId: true, order: true },
      orderBy: { order: "asc" },
    });
    // Pick the last status (highest order) per project
    const lastStatusPerProject: Record<string, string> = {};
    for (const s of allStatuses) {
      lastStatusPerProject[s.projectId] = s.id; // later entries overwrite → highest order wins
    }
    const lastStatusIds = Object.values(lastStatusPerProject);
    if (lastStatusIds.length > 0) {
      const doneCounts = await prisma.task.groupBy({
        by: ["projectId"],
        where: { status: { in: lastStatusIds } },
        _count: { id: true },
      });
      for (const row of doneCounts) {
        doneCountMap[row.projectId] = row._count.id;
      }
    }
  }

  const enriched = projects.map((p) => ({
    ...p,
    _count: {
      ...(p._count as object),
      doneTasks: doneCountMap[p.id] ?? 0,
    },
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { name, description, status, color, dueDate, memberIds, hourlyRate, budget } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    // Create project + default statuses atomically, so every new project is
    // immediately usable and `task.status` references (which store TaskStatus IDs)
    // always resolve to a real row.
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          description,
          status: status || undefined,
          color,
          dueDate:    dueDate    ? new Date(dueDate)  : undefined,
          hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : undefined,
          budget:     budget     !== undefined ? Number(budget)     : undefined,
          members: {
            create: [
              // Add the creator as a member
              { userId: session.user.id },
              // Add any additional members
              ...(memberIds || [])
                .filter((id: string) => id !== session.user.id)
                .map((id: string) => ({ userId: id })),
            ],
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true, role: true, image: true } } },
          },
        },
      });

      // Seed the default 5-column workflow. Status IDs are globally namespaced
      // with the project ID to keep them unique across projects.
      await tx.taskStatus.createMany({
        data: DEFAULT_STATUSES.map((s) => ({
          ...s,
          id: `${created.id}_${s.id}`,
          projectId: created.id,
        })),
      });

      return created;
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
