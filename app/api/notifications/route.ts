import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  // Filter by one or more notification types (comma-separated). Used by the
  // Inbox page to narrow to e.g. "MENTION,TASK_COMMENT".
  const types = searchParams.get("types")?.split(",").filter(Boolean) ?? [];
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 200);

  const where: Record<string, unknown> = { userId };
  if (unreadOnly) where.read = false;
  if (types.length > 0) where.type = { in: types };

  // Counts by type — small overhead, lets the inbox show filter badges.
  const [notifications, unreadCount, typeCountsRaw] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.groupBy({
      by: ["type"],
      where: { userId, read: false },
      _count: { _all: true },
    }),
  ]);

  const typeCounts: Record<string, number> = {};
  for (const row of typeCountsRaw) typeCounts[row.type] = row._count._all;

  return NextResponse.json({ notifications, unreadCount, typeCounts });
}

// Mark all as read
export async function PATCH() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}

// Delete all read notifications
export async function DELETE() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  await prisma.notification.deleteMany({
    where: { userId: session.user.id, read: true },
  });

  return NextResponse.json({ success: true });
}
