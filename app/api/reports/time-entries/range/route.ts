/**
 * GET /api/reports/time-entries/range
 *
 * Liefert min/max startedAt der Time-Entries, gefiltert nach Projekt/User
 * — wird vom Reports-Filter "Gesamter Zeitraum" genutzt um automatisch
 * vom ersten bis zum letzten Eintrag zu spannen.
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
  const isAdmin = session.user.role === "ADMIN";

  const where: Record<string, unknown> = {
    duration: { gt: 0 },
    ...(userId ? { userId } : isAdmin ? {} : { userId: session.user.id }),
    ...(projectId ? { task: { projectId } } : {}),
    ...(!isAdmin && !projectId
      ? {
          task: {
            project: { members: { some: { userId: session.user.id } } },
          },
        }
      : {}),
  };

  const [first, last] = await Promise.all([
    prisma.timeEntry.findFirst({ where, orderBy: { startedAt: "asc" },  select: { startedAt: true } }),
    prisma.timeEntry.findFirst({ where, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
  ]);

  return NextResponse.json({
    from: first?.startedAt ? first.startedAt.toISOString().slice(0, 10) : null,
    to:   last?.startedAt  ? last.startedAt.toISOString().slice(0, 10)  : null,
  });
}
