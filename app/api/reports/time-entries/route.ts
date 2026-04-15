/**
 * GET /api/reports/time-entries
 *
 * Returns aggregated time-entry data for the reports page.
 * Supports filtering by: projectId, userId, dateFrom, dateTo.
 *
 * Response shape:
 *   {
 *     entries: TimeEntryRow[],    // full list for the table
 *     byProject: Summary[],       // total seconds per project
 *     byUser: Summary[],          // total seconds per user
 *     byDay: DaySummary[],        // total seconds per calendar day (for chart)
 *     totalSeconds: number,
 *   }
 *
 * Access: ADMIN + MEMBER see all entries (MEMBER: only their projects).
 *         CLIENT has no access (403).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId") || undefined;
  const userId = searchParams.get("userId") || undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const isAdmin = session.user.role === "ADMIN";

  // Build where clause
  const where: any = {
    duration: { gt: 0 }, // only completed entries
    ...(userId ? { userId } : isAdmin ? {} : { userId: session.user.id }),
    ...(projectId ? { task: { projectId } } : {}),
    ...(dateFrom || dateTo
      ? {
          startedAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
          },
        }
      : {}),
    // MEMBER: only their own projects
    ...(!isAdmin && !projectId
      ? {
          task: {
            project: {
              members: { some: { userId: session.user.id } },
            },
          },
        }
      : {}),
  };

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 500,
  });

  const totalSeconds = entries.reduce((s, e) => s + e.duration, 0);

  // Aggregate by project
  const projectMap = new Map<string, { id: string; name: string; color: string | null; seconds: number }>();
  for (const e of entries) {
    const p = e.task.project;
    const existing = projectMap.get(p.id);
    if (existing) {
      existing.seconds += e.duration;
    } else {
      projectMap.set(p.id, { id: p.id, name: p.name, color: p.color, seconds: e.duration });
    }
  }

  // Aggregate by user
  const userMap = new Map<string, { id: string; name: string | null; email: string; image: string | null; seconds: number }>();
  for (const e of entries) {
    const u = e.user;
    const existing = userMap.get(u.id);
    if (existing) {
      existing.seconds += e.duration;
    } else {
      userMap.set(u.id, { id: u.id, name: u.name, email: u.email, image: u.image, seconds: e.duration });
    }
  }

  // Aggregate by day (YYYY-MM-DD)
  const dayMap = new Map<string, number>();
  for (const e of entries) {
    const day = e.startedAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + e.duration);
  }
  const byDay = Array.from(dayMap.entries())
    .map(([date, seconds]) => ({ date, seconds }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      duration: e.duration,
      startedAt: e.startedAt.toISOString(),
      stoppedAt: e.stoppedAt?.toISOString() ?? null,
      description: e.description,
      user: e.user,
      task: { id: e.task.id, title: e.task.title, project: e.task.project },
    })),
    byProject: Array.from(projectMap.values()).sort((a, b) => b.seconds - a.seconds),
    byUser: Array.from(userMap.values()).sort((a, b) => b.seconds - a.seconds),
    byDay,
    totalSeconds,
  });
}
