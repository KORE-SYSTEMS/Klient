import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

// GET time entries for a task
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { taskId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json(entries);
}

// POST: start a new timer
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;

  try {
    const body = await request.json();
    const { taskId, description } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // Stop any currently running timer for this user
    const runningEntries = await prisma.timeEntry.findMany({
      where: { userId, stoppedAt: null },
    });

    for (const entry of runningEntries) {
      const duration = Math.floor(
        (Date.now() - new Date(entry.startedAt).getTime()) / 1000
      );
      await prisma.timeEntry.update({
        where: { id: entry.id },
        data: { stoppedAt: new Date(), duration },
      });
    }

    // Start new timer
    const timeEntry = await prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        description: description || null,
        startedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true, status: true, projectId: true } },
      },
    });

    return NextResponse.json(timeEntry, { status: 201 });
  } catch (error) {
    console.error("Failed to start timer:", error);
    return NextResponse.json({ error: "Failed to start timer" }, { status: 500 });
  }
}
