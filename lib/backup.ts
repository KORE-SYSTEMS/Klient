/**
 * Backups of the SQLite database and (optionally) the uploads folder.
 *
 * - The database is copied with `VACUUM INTO`, which yields a consistent snapshot
 *   even while the app is running (a plain file copy could be torn mid-write).
 * - Everything is packed into one `.tar.gz` inside the backup directory.
 * - The backup directory defaults to `<db folder>/backups` (i.e. inside the
 *   existing data volume — no extra mount needed). Set KLIENT_BACKUP_DIR to
 *   point it at a separate volume.
 * - Settings live in a JSON file next to the backups, so no schema change.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  mkdtempSync,
  rmSync,
  renameSync,
  accessSync,
  constants,
} from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const run = promisify(execFile);

export type BackupKind = "auto" | "manual" | "pre-update";

export interface BackupInfo {
  name: string;
  kind: BackupKind;
  size: number;
  createdAt: string; // ISO
}

export interface BackupSettings {
  autoEnabled: boolean;
  /** Local hour (0-23) after which the daily automatic backup becomes due. */
  autoHour: number;
  keepAuto: number;
  keepPreUpdate: number;
  includeUploads: boolean;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoEnabled: true,
  autoHour: 3,
  keepAuto: 7,
  keepPreUpdate: 5,
  includeUploads: true,
};

const NAME_RE = /^klient-backup_(\d{8}-\d{6})_(auto|manual|pre-update)\.tar\.gz$/;
const SETTINGS_FILE = "backup-settings.json";

// ── Paths ────────────────────────────────────────────────────────────────────

function dbFilePath(): string {
  const url = process.env.DATABASE_URL || "file:/app/data/klient.db";
  const p = url.replace(/^file:/, "").split("?")[0];
  // Prisma resolves relative SQLite paths against the schema folder
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
}

export function backupDir(): string {
  return process.env.KLIENT_BACKUP_DIR || path.join(path.dirname(dbFilePath()), "backups");
}

function uploadsDir(): string {
  return path.join(process.cwd(), "uploads");
}

function ensureWritableDir(dir: string) {
  mkdirSync(dir, { recursive: true });
  try {
    accessSync(dir, constants.W_OK);
  } catch {
    throw new Error(`Backup-Ordner ist nicht beschreibbar: ${dir}`);
  }
}

/** Resolves a backup file name to its absolute path; null if the name is not a valid backup name. */
export function backupPath(name: string): string | null {
  return NAME_RE.test(name) ? path.join(backupDir(), name) : null;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function readBackupSettings(): BackupSettings {
  try {
    const raw = JSON.parse(readFileSync(path.join(backupDir(), SETTINGS_FILE), "utf8"));
    return sanitizeSettings({ ...DEFAULT_BACKUP_SETTINGS, ...raw });
  } catch {
    return { ...DEFAULT_BACKUP_SETTINGS };
  }
}

export function sanitizeSettings(input: Partial<BackupSettings>): BackupSettings {
  const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const d = DEFAULT_BACKUP_SETTINGS;
  return {
    autoEnabled: input.autoEnabled ?? d.autoEnabled,
    autoHour: clamp(input.autoHour, 0, 23, d.autoHour),
    keepAuto: clamp(input.keepAuto, 1, 60, d.keepAuto),
    keepPreUpdate: clamp(input.keepPreUpdate, 1, 30, d.keepPreUpdate),
    includeUploads: input.includeUploads ?? d.includeUploads,
  };
}

export function writeBackupSettings(settings: BackupSettings) {
  ensureWritableDir(backupDir());
  writeFileSync(path.join(backupDir(), SETTINGS_FILE), JSON.stringify(settings, null, 2));
}

// ── Listing / deleting ───────────────────────────────────────────────────────

function parseStamp(stamp: string): Date {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/)!;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

export function listBackups(): BackupInfo[] {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  const out: BackupInfo[] = [];
  for (const name of readdirSync(dir)) {
    const m = name.match(NAME_RE);
    if (!m) continue;
    try {
      const st = statSync(path.join(dir, name));
      out.push({
        name,
        kind: m[2] as BackupKind,
        size: st.size,
        createdAt: parseStamp(m[1]).toISOString(),
      });
    } catch {
      /* file vanished between readdir and stat */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteBackup(name: string): boolean {
  const p = backupPath(name);
  if (!p || !existsSync(p)) return false;
  rmSync(p);
  return true;
}

function prune(settings: BackupSettings) {
  const all = listBackups();
  const limits: Partial<Record<BackupKind, number>> = {
    auto: settings.keepAuto,
    "pre-update": settings.keepPreUpdate,
  };
  for (const [kind, keep] of Object.entries(limits) as [BackupKind, number][]) {
    for (const b of all.filter((x) => x.kind === kind).slice(keep)) deleteBackup(b.name);
  }
}

// ── Creating ─────────────────────────────────────────────────────────────────

let running: Promise<BackupInfo> | null = null;

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

/** Creates a backup. Concurrent calls share the one that is already running. */
export function createBackup(kind: BackupKind): Promise<BackupInfo> {
  if (running) return running;
  running = doBackup(kind).finally(() => {
    running = null;
  });
  return running;
}

async function doBackup(kind: BackupKind): Promise<BackupInfo> {
  const dir = backupDir();
  ensureWritableDir(dir);
  const settings = readBackupSettings();

  const staging = mkdtempSync(path.join(dir, ".tmp-"));
  const name = `klient-backup_${stamp()}_${kind}.tar.gz`;
  const tmpArchive = path.join(dir, `.tmp-${name}`);
  try {
    // 1. Consistent database snapshot
    const dbCopy = path.join(staging, "klient.db");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${dbCopy.replace(/'/g, "''")}'`);

    // 2. Uploads are linked in and dereferenced by tar (-h), so nothing is copied twice
    const includeUploads = settings.includeUploads && existsSync(uploadsDir());
    if (includeUploads) symlinkSync(uploadsDir(), path.join(staging, "uploads"));

    writeFileSync(
      path.join(staging, "manifest.json"),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          kind,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
          includesUploads: includeUploads,
          databaseBytes: statSync(dbCopy).size,
        },
        null,
        2
      )
    );

    // 3. Pack and verify the archive can be read back
    await run("tar", ["-czhf", tmpArchive, "-C", staging, "."]);
    await run("tar", ["-tzf", tmpArchive]);

    renameSync(tmpArchive, path.join(dir, name));
    prune(settings);

    const st = statSync(path.join(dir, name));
    return { name, kind, size: st.size, createdAt: new Date().toISOString() };
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(tmpArchive, { force: true });
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

const CHECK_EVERY_MS = 15 * 60 * 1000;
const MIN_GAP_MS = 20 * 60 * 60 * 1000;

async function tick() {
  try {
    const s = readBackupSettings();
    if (!s.autoEnabled) return;
    const now = new Date();
    if (now.getHours() < s.autoHour) return;
    const last = listBackups().find((b) => b.kind === "auto");
    if (last && now.getTime() - new Date(last.createdAt).getTime() < MIN_GAP_MS) return;
    await createBackup("auto");
    console.log("[backup] Automatic backup created");
  } catch (e) {
    console.error("[backup] Automatic backup failed:", e);
  }
}

/** Starts the daily check once per process (safe to call repeatedly). */
export function startBackupScheduler() {
  const g = globalThis as { __klientBackupScheduler?: NodeJS.Timeout };
  if (g.__klientBackupScheduler) return;
  g.__klientBackupScheduler = setInterval(tick, CHECK_EVERY_MS);
  g.__klientBackupScheduler.unref?.();
  // First check shortly after startup, so a missed night is caught up quickly
  setTimeout(tick, 60_000).unref?.();
}
