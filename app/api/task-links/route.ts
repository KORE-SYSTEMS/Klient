import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";

export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { sourceTaskId, targetTaskId, type } = body;

    if (!sourceTaskId || !targetTaskId) {
      return NextResponse.json({ error: "sourceTaskId and targetTaskId are required" }, { status: 400 });
    }

    if (sourceTaskId === targetTaskId) {
      return NextResponse.json({ error: "Cannot link a task to itself" }, { status: 400 });
    }

    // Check if link already exists
    const existing = await prisma.taskLink.findFirst({
      where: {
        OR: [
          { sourceTaskId, targetTaskId },
          { sourceTaskId: targetTaskId, targetTaskId: sourceTaskId },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Link already exists" }, { status: 400 });
    }

    const link = await prisma.taskLink.create({
      data: {
        sourceTaskId,
        targetTaskId,
        type: type || "RELATED",
      },
      include: {
        sourceTask: { select: { id: true, title: true, status: true } },
        targetTask: { select: { id: true, title: true, status: true } },
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("Failed to create task link:", error);
    return NextResponse.json({ error: "Failed to create task link" }, { status: 500 });
  }
}
