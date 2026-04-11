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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update client:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

// DELETE: Deactivate client (soft delete)
export async function DELETE(
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
    const updated = await prisma.user.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to deactivate client:", error);
    return NextResponse.json({ error: "Failed to deactivate client" }, { status: 500 });
  }
}
