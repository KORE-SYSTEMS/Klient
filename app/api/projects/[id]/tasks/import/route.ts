import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";
import { csvParse, csvToObjects } from "@/lib/csv";

/**
 * Bulk-Import von Tasks (inkl. Subtasks). Akzeptiert:
 *
 *   POST /api/projects/[id]/tasks/import
 *   Content-Type: text/csv      → Body ist CSV
 *   Content-Type: application/json → Body ist Array<Row> oder { rows: Array<Row>, dryRun?: boolean }
 *
 *   ?dryRun=true                 → nichts wird geschrieben, nur Validierung
 *   ?createMissingEpics=true     → unbekannte Epic-Namen werden on-the-fly angelegt
 *
 * Two-Pass-Verfahren:
 *   1) Top-Level-Tasks (ohne parentTitle) anlegen, Map title→id bauen
 *   2) Subtasks anlegen, parent über die Map auflösen
 *
 * Antwort:
 *   {
 *     created:  { topLevel: number, subtasks: number },
 *     skipped:  Array<{ row: number, reason: string }>,
 *     warnings: Array<{ row: number, message: string }>,
 *     dryRun:   boolean
 *   }
 */

interface RawRow {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  assignee?: string;
  epic?: string;
  parentTitle?: string;
  clientVisible?: string | boolean;
}

interface NormalizedRow {
  title: string;
  description: string | null;
  statusId: string;          // resolved
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  assigneeId: string | null;
  epicId: string | null;
  parentTitle: string;       // empty = top-level
  clientVisible: boolean;
  rowIndex: number;
}

interface ImportResult {
  created: { topLevel: number; subtasks: number };
  skipped: { row: number; reason: string }[];
  warnings: { row: number; message: string }[];
  dryRun: boolean;
}

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function parseBoolean(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return fallback;
  const s = v.trim().toLowerCase();
  if (["true", "1", "yes", "ja", "x"].includes(s)) return true;
  if (["false", "0", "no", "nein", ""].includes(s)) return false;
  return fallback;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id: projectId } = await params;
  const userId = session.user.id;
  const role = session.user.role;
  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dryRunParam = searchParams.get("dryRun") === "true";
  const createMissingEpics = searchParams.get("createMissingEpics") === "true";

  // ── Body-Parsing ────────────────────────────────────────────────────────
  let rows: RawRow[];
  let dryRun = dryRunParam;
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (Array.isArray(body)) {
        rows = body as RawRow[];
      } else if (body && Array.isArray(body.rows)) {
        rows = body.rows as RawRow[];
        if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
      } else {
        return NextResponse.json({ error: "JSON muss Array oder { rows: [...] } sein" }, { status: 400 });
      }
    } else {
      // Treat as CSV
      const text = await request.text();
      rows = csvToObjects<Record<string, string>>(csvParse(text)) as RawRow[];
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Konnte Body nicht parsen", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Keine Zeilen erkannt" }, { status: 400 });
  }

  // ── Lookup-Tabellen vorbereiten ─────────────────────────────────────────
  const [statuses, epics, members] = await Promise.all([
    prisma.taskStatus.findMany({
      where: { projectId },
      select: { id: true, name: true, order: true },
      orderBy: { order: "asc" },
    }),
    prisma.epic.findMany({ where: { projectId }, select: { id: true, title: true } }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, email: true } } },
    }),
  ]);

  const firstStatusId = statuses[0]?.id;
  if (!firstStatusId) {
    return NextResponse.json(
      { error: "Projekt hat keine Workflow-Spalten — lege erst welche an" },
      { status: 400 },
    );
  }

  const statusByName = new Map(statuses.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const memberByEmail = new Map(
    members
      .filter((m) => m.user?.email)
      .map((m) => [m.user.email.trim().toLowerCase(), m.user.id]),
  );
  const epicByName = new Map(epics.map((e) => [e.title.trim().toLowerCase(), e.id]));

  // ── Normalize + Validate ────────────────────────────────────────────────
  const normalized: NormalizedRow[] = [];
  const skipped: ImportResult["skipped"] = [];
  const warnings: ImportResult["warnings"] = [];
  // Counter for dynamically-created epics (only when createMissingEpics)
  const epicCreations: { name: string }[] = [];

  rows.forEach((raw, idx) => {
    const rowIndex = idx + 2; // +1 for 1-based, +1 for header
    const title = raw.title?.toString().trim();
    if (!title) {
      skipped.push({ row: rowIndex, reason: "title fehlt" });
      return;
    }

    // status
    const rawStatus = raw.status?.toString().trim();
    let statusId = firstStatusId;
    if (rawStatus) {
      const found = statusByName.get(rawStatus.toLowerCase());
      if (found) statusId = found;
      else warnings.push({ row: rowIndex, message: `Status "${rawStatus}" nicht gefunden — Default verwendet` });
    }

    // priority
    const rawPriority = (raw.priority?.toString().trim().toUpperCase() || "MEDIUM");
    const priority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : "MEDIUM";
    if (rawPriority !== priority) {
      warnings.push({ row: rowIndex, message: `Unbekannte Priorität "${raw.priority}" — MEDIUM verwendet` });
    }

    // startDate
    const startDate = parseDate(raw.startDate?.toString());
    if (raw.startDate && !startDate) {
      warnings.push({ row: rowIndex, message: `Ungültiges Startdatum "${raw.startDate}" — leer gelassen` });
    }

    // dueDate
    const dueDate = parseDate(raw.dueDate?.toString());
    if (raw.dueDate && !dueDate) {
      warnings.push({ row: rowIndex, message: `Ungültiges Datum "${raw.dueDate}" — leer gelassen` });
    }

    // assignee (email)
    let assigneeId: string | null = null;
    const rawAssignee = raw.assignee?.toString().trim();
    if (rawAssignee) {
      const found = memberByEmail.get(rawAssignee.toLowerCase());
      if (found) assigneeId = found;
      else warnings.push({ row: rowIndex, message: `Member "${rawAssignee}" nicht im Projekt — keine Zuweisung` });
    }

    // epic
    let epicId: string | null = null;
    const rawEpic = raw.epic?.toString().trim();
    if (rawEpic) {
      const key = rawEpic.toLowerCase();
      const found = epicByName.get(key);
      if (found) {
        epicId = found;
      } else if (createMissingEpics) {
        // Defer creation; we just mark the name. The actual create happens
        // before the task batch in the transaction below.
        epicCreations.push({ name: rawEpic });
        // Will be filled in after creation — placeholder stays null here,
        // we re-resolve in the second normalization pass below.
      } else {
        warnings.push({ row: rowIndex, message: `Epic "${rawEpic}" existiert nicht (createMissingEpics=false)` });
      }
    }

    normalized.push({
      title,
      description: raw.description?.toString().trim() || null,
      statusId,
      priority,
      startDate,
      dueDate,
      assigneeId,
      epicId,
      parentTitle: raw.parentTitle?.toString().trim() ?? "",
      clientVisible: parseBoolean(raw.clientVisible),
      rowIndex,
    });
  });

  // Validate parent references — every parentTitle must point to a top-level
  // row in the same import. (Existing tasks in the project are NOT considered
  // valid parents — keeps the import self-contained and predictable.)
  const topLevelTitles = new Set(
    normalized.filter((r) => !r.parentTitle).map((r) => r.title.toLowerCase()),
  );
  const finalRows: NormalizedRow[] = [];
  for (const row of normalized) {
    if (row.parentTitle && !topLevelTitles.has(row.parentTitle.toLowerCase())) {
      skipped.push({
        row: row.rowIndex,
        reason: `Parent "${row.parentTitle}" nicht im Import gefunden`,
      });
      continue;
    }
    finalRows.push(row);
  }

  if (dryRun) {
    return NextResponse.json({
      created: {
        topLevel: finalRows.filter((r) => !r.parentTitle).length,
        subtasks: finalRows.filter((r) => r.parentTitle).length,
      },
      skipped,
      warnings,
      dryRun: true,
    } satisfies ImportResult);
  }

  // ── Echtes Anlegen ──────────────────────────────────────────────────────
  // 1) fehlende Epics anlegen
  if (createMissingEpics) {
    const uniqueNames = Array.from(new Set(epicCreations.map((e) => e.name.toLowerCase())));
    for (const lower of uniqueNames) {
      if (epicByName.has(lower)) continue;
      const sample = epicCreations.find((e) => e.name.toLowerCase() === lower)!;
      const created = await prisma.epic.create({
        data: { title: sample.name, projectId },
      });
      epicByName.set(lower, created.id);
    }
    // Re-resolve epicId on rows that had a missing epic
    for (const row of finalRows) {
      if (row.epicId) continue;
      // Find original raw value via rowIndex
      const rawIdx = row.rowIndex - 2;
      const rawEpic = rows[rawIdx]?.epic?.toString().trim();
      if (rawEpic) row.epicId = epicByName.get(rawEpic.toLowerCase()) ?? null;
    }
  }

  // 2) Top-Level zuerst, mappen
  const topLevel = finalRows.filter((r) => !r.parentTitle);
  const subtasks = finalRows.filter((r) => r.parentTitle);

  const titleToId = new Map<string, string>();
  let createdTop = 0;
  let createdSub = 0;

  for (const row of topLevel) {
    const created = await prisma.task.create({
      data: {
        title: row.title,
        description: row.description,
        status: row.statusId,
        priority: row.priority,
        clientVisible: row.clientVisible,
        startDate: row.startDate,
        dueDate: row.dueDate,
        projectId,
        assigneeId: row.assigneeId,
        epicId: row.epicId,
      },
      select: { id: true },
    });
    titleToId.set(row.title.toLowerCase(), created.id);
    createdTop++;
  }

  for (const row of subtasks) {
    const parentId = titleToId.get(row.parentTitle.toLowerCase());
    if (!parentId) {
      skipped.push({ row: row.rowIndex, reason: `Parent-ID konnte nicht aufgelöst werden` });
      continue;
    }
    await prisma.task.create({
      data: {
        title: row.title,
        description: row.description,
        status: row.statusId,
        priority: row.priority,
        clientVisible: row.clientVisible,
        startDate: row.startDate,
        dueDate: row.dueDate,
        projectId,
        assigneeId: row.assigneeId,
        epicId: row.epicId,
        parentId,
      },
    });
    createdSub++;
  }

  return NextResponse.json({
    created: { topLevel: createdTop, subtasks: createdSub },
    skipped,
    warnings,
    dryRun: false,
  } satisfies ImportResult);
}
