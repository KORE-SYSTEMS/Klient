import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

// PATCH: stop a running timer or update description
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
  }

  // Only the owner or admin can modify
  if (entry.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Stop timer
    if (body.stop === true && !entry.stoppedAt) {
      const now = new Date();
      updateData.stoppedAt = now;
      updateData.duration = Math.floor(
        (now.getTime() - new Date(entry.startedAt).getTime()) / 1000
      );
    }

    // Manual duration override
    if (body.duration !== undefined) {
      updateData.duration = body.duration;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    const updated = await prisma.timeEntry.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true, status: true, projectId: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update time entry:", error);
    return NextResponse.json({ error: "Failed to update time entry" }, { status: 500 });
  }
}

// DELETE a time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Time entry not found" }, { status: 404 });
  }

  if (entry.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.timeEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete time entry:", error);
    return NextResponse.json({ error: "Failed to delete time entry" }, { status: 500 });
  }
}
