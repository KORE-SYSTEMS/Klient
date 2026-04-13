import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

// GET: Single client with their projects
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const client = await prisma.user.findUnique({
    where: { id, role: "CLIENT" },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      image: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      projects: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              description: true,
              dueDate: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(client);
}

// PATCH: Update client details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const client = await prisma.user.findUnique({
    where: { id, role: "CLIENT" },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.image !== undefined) updateData.image = body.image;
    if (body.active !== undefined) updateData.active = body.active;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        image: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If projectIds provided, update project assignments
    if (body.projectIds !== undefined && Array.isArray(body.projectIds)) {
      // Remove all current project memberships for this client
      await prisma.projectMember.deleteMany({ where: { userId: id } });
      // Create new memberships
      if (body.projectIds.length > 0) {
        await prisma.projectMember.createMany({
          data: body.projectIds.map((pid: string) => ({
            userId: id,
            projectId: pid,
          })),
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update client:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

// DELETE: Hard delete if possible, otherwise soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    await prisma.user.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2003") {
      // Foreign key constraint failed -> Fallback to soft delete
      await prisma.projectMember.deleteMany({ where: { userId: id } });
      await prisma.user.update({
        where: { id },
        data: { active: false },
      });
      return NextResponse.json({ success: true, softDeleted: true });
    }
    console.error("Failed to delete client:", error);
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
