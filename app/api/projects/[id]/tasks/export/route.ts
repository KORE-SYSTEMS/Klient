import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess } from "@/lib/auth-guard";
import { csvStringify } from "@/lib/csv";

/**
 * Export aller Tasks (inkl. Subtasks) eines Projekts als CSV oder JSON.
 *
 *   GET /api/projects/[id]/tasks/export?format=csv|json[&sample=true]
 *
 * Mit `sample=true` wird statt der echten Daten ein Beispiel-CSV ausgeliefert,
 * das man als Vorlage befüllen und über /import wieder hochladen kann.
 *
 * CSV-Schema (Header in dieser Reihenfolge):
 *   title, description, status, priority, startDate, dueDate, assignee, epic, parentTitle, clientVisible
 *
 *   - status, epic        → Anzeigenamen (case-insensitive Match beim Import)
 *   - assignee            → E-Mail-Adresse
 *   - dueDate             → ISO-Date (YYYY-MM-DD), leer = keins
 *   - parentTitle         → Titel des Parent-Tasks im selben Export, leer = top-level
 *   - clientVisible       → "true" / "false"
 */

// Header-Reihenfolge — Next.js Route-Handler dürfen nur HTTP-Methoden
// exportieren, deshalb bleibt das Array module-private.
const CSV_HEADERS = [
  "title",
  "description",
  "status",
  "priority",
  "startDate",
  "dueDate",
  "assignee",
  "epic",
  "parentTitle",
  "clientVisible",
] as const;

const SAMPLE_ROWS: string[][] = [
  ["Onboarding-Call vorbereiten", "Agenda + Folien für Kickoff", "Backlog", "HIGH", "", "", "", "Onboarding", "", "false"],
  ["Briefing durchgehen", "Mit Kunden Anforderungen klären", "Backlog", "MEDIUM", "", "", "", "Onboarding", "Onboarding-Call vorbereiten", "false"],
  ["Folien-Template anpassen", "", "Backlog", "LOW", "", "", "", "Onboarding", "Onboarding-Call vorbereiten", "false"],
  ["Wireframes erstellen", "Zwei Varianten zur Abstimmung", "In Arbeit", "MEDIUM", "2026-05-10", "2026-05-15", "team@example.com", "Design", "", "true"],
];

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;
  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "csv").toLowerCase();
  const sample = searchParams.get("sample") === "true";

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  const projectName = project?.name ?? "tasks";
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tasks";

  // ── Sample-Path: liefert fest verdrahtete Beispieldaten ohne DB-Hits ───
  if (sample) {
    if (format === "json") {
      const json = SAMPLE_ROWS.map((row) =>
        Object.fromEntries(CSV_HEADERS.map((h, i) => [h, row[i] ?? ""])),
      );
      return new NextResponse(JSON.stringify(json, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="tasks-sample.json"`,
        },
      });
    }
    const csv = csvStringify([CSV_HEADERS as unknown as string[], ...SAMPLE_ROWS]);
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tasks-sample.csv"`,
      },
    });
  }

  // ── Echter Export ───────────────────────────────────────────────────────
  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { email: true } },
      epic: { select: { title: true } },
      parent: { select: { title: true } },
      checklistItems: {
        select: { title: true, done: true, order: true },
        orderBy: { order: "asc" },
      },
      timeEntries: {
        select: {
          startedAt: true,
          stoppedAt: true,
          duration: true,
          description: true,
          user: { select: { email: true } },
        },
        orderBy: { startedAt: "asc" },
      },
      comments: {
        select: {
          content: true,
          createdAt: true,
          author: { select: { email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ parentId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  const statuses = await prisma.taskStatus.findMany({
    where: { projectId },
    select: { id: true, name: true },
  });
  const statusName = new Map(statuses.map((s) => [s.id, s.name]));

  const rows = tasks.map((t) => [
    t.title,
    t.description ?? "",
    statusName.get(t.status) ?? t.status,
    t.priority,
    fmtDate(t.startDate),
    fmtDate(t.dueDate),
    t.assignee?.email ?? "",
    t.epic?.title ?? "",
    t.parent?.title ?? "",
    t.clientVisible ? "true" : "false",
  ]);

  if (format === "json") {
    // JSON exportiert alles nested — Time-Entries, Checklist, Comments,
    // Recurrence, Approval, Reihenfolge. Reichhaltiger als CSV.
    const json = tasks.map((t) => ({
      title: t.title,
      description: t.description ?? "",
      status: statusName.get(t.status) ?? t.status,
      priority: t.priority,
      startDate: fmtDate(t.startDate),
      dueDate: fmtDate(t.dueDate),
      assignee: t.assignee?.email ?? "",
      epic: t.epic?.title ?? "",
      parentTitle: t.parent?.title ?? "",
      clientVisible: t.clientVisible,
      order: t.order,
      recurrenceRule: t.recurrenceRule ?? null,
      approvalStatus: t.approvalStatus ?? null,
      handoffComment: t.handoffComment ?? null,
      approvalComment: t.approvalComment ?? null,
      checklist: t.checklistItems.map((c) => ({
        title: c.title,
        done: c.done,
      })),
      timeEntries: t.timeEntries.map((e) => ({
        startedAt: e.startedAt.toISOString(),
        stoppedAt: e.stoppedAt ? e.stoppedAt.toISOString() : null,
        duration: e.duration,
        description: e.description ?? null,
        userEmail: e.user?.email ?? null,
      })),
      comments: t.comments.map((c) => ({
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        authorEmail: c.author?.email ?? null,
      })),
    }));
    return new NextResponse(JSON.stringify(json, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-tasks-full.json"`,
      },
    });
  }

  // CSV (default). BOM voranstellen damit Excel UTF-8 erkennt.
  const csv = csvStringify([CSV_HEADERS as unknown as string[], ...rows]);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-tasks.csv"`,
    },
  });
}
