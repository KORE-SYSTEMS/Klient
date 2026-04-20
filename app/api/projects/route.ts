import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember } from "@/lib/auth-guard";

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
    const { name, description, status, color, dueDate, memberIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        status: status || undefined,
        color,
        dueDate: dueDate ? new Date(dueDate) : undefined,
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

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
