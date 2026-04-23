import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

/**
 * POST /api/projects/[id]/statuses/reorder
 * Body: { order: string[] }  // array of status ids in new order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const orderIds: string[] = Array.isArray(body?.order) ? body.order : [];
    if (!orderIds.length) return NextResponse.json({ error: "order[] required" }, { status: 400 });

    await prisma.$transaction(
      orderIds.map((id, idx) =>
        prisma.taskStatus.updateMany({
          where: { id, projectId },
          data: { order: idx },
        })
      )
    );

    const statuses = await prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(statuses);
  } catch (error) {
    console.error("Failed to reorder statuses:", error);
    return NextResponse.json({ error: "Failed to reorder statuses" }, { status: 500 });
  }
}
