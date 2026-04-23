import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember } from "@/lib/auth-guard";
import { getTemplate, DEFAULT_TEMPLATE_ID } from "@/lib/workflow-templates";

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
  // "Done" = task whose status has category === "DONE" in that project.
  // Uses the semantic category rather than "last column" so that inserting new
  // phases after Done (e.g. "Archived") doesn't silently break completion %.
  let doneCountMap: Record<string, number> = {};
  if (projectIds.length > 0) {
    const doneStatuses = await prisma.taskStatus.findMany({
      where: { projectId: { in: projectIds }, category: "DONE" },
      select: { id: true, projectId: true },
    });
    const doneStatusIds = doneStatuses.map((s) => s.id);
    if (doneStatusIds.length > 0) {
      const doneCounts = await prisma.task.groupBy({
        by: ["projectId"],
        where: { status: { in: doneStatusIds } },
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
    // Allow callers to pick a starting workflow template (e.g. "simple" for
    // lightweight projects, "client-approval" when a client sign-off phase is needed).
    const templateId = typeof body.workflowTemplateId === "string" ? body.workflowTemplateId : DEFAULT_TEMPLATE_ID;
    const tpl = getTemplate(templateId) || getTemplate(DEFAULT_TEMPLATE_ID)!;

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

      // Seed the chosen workflow. Status IDs are globally namespaced with the
      // project id to keep them unique across projects.
      await tx.taskStatus.createMany({
        data: tpl.statuses.map((s, idx) => ({
          id: `${created.id}_${s.slug}`,
          name: s.name,
          color: s.color,
          order: idx,
          category: s.category,
          isApproval: s.isApproval ?? false,
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
