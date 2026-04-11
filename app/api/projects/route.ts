import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember } from "@/lib/auth-guard";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;
  const role = session.user.role;

  let projects;

  if (role === "ADMIN") {
    // Admins see all projects
    projects = await prisma.project.findMany({
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
    // Clients only see their own projects
    projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
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

  return NextResponse.json(projects);
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
