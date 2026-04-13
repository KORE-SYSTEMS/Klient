import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  if (m > 0) {
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  return `${s}s`;
}

// PATCH: stop a running timer or update description
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const entry = await prisma.timeEntry.findUnique({
    where: { id },
    include: {
      task: { select: { id: true, title: true, status: true, projectId: true } },
    },
  });
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
    let wasStopped = false;
    let duration = 0;

    // Stop timer
    if (body.stop === true && !entry.stoppedAt) {
      const now = new Date();
      duration = Math.floor(
        (now.getTime() - new Date(entry.startedAt).getTime()) / 1000
      );
      updateData.stoppedAt = now;
      updateData.duration = duration;
      wasStopped = true;
    }

    // Manual duration override
    if (body.duration !== undefined) {
      updateData.duration = body.duration;
      duration = body.duration;
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

    // If timer was stopped, post a message to the project chat
    if (wasStopped && entry.task?.projectId) {
      const userName = session.user.name || session.user.email || "Jemand";
      const taskTitle = entry.task.title;
      const durationStr = formatDuration(duration);
      const comment = body.description?.trim();

      let messageContent = `⏱️ **${userName}** hat **${durationStr}** an „${taskTitle}" gearbeitet.`;
      if (comment) {
        messageContent += `\n\n> ${comment}`;
      }

      await prisma.message.create({
        data: {
          content: messageContent,
          projectId: entry.task.projectId,
          authorId: session.user.id,
        },
      });
    }

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
