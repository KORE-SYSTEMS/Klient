import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import {
  backupDir,
  createBackup,
  listBackups,
  readBackupSettings,
  sanitizeSettings,
  writeBackupSettings,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

/** GET — list backups + settings. */
export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  return NextResponse.json({
    dir: backupDir(),
    settings: readBackupSettings(),
    backups: listBackups(),
  });
}

/** POST — create a manual backup now. */
export async function POST() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const backup = await createBackup("manual");
    return NextResponse.json(backup, { status: 201 });
  } catch (e) {
    console.error("[backup] Manual backup failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Backup fehlgeschlagen" },
      { status: 500 }
    );
  }
}

/** PATCH — update backup settings. */
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const next = sanitizeSettings({ ...readBackupSettings(), ...body });
  try {
    writeBackupSettings(next);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Einstellungen konnten nicht gespeichert werden" },
      { status: 500 }
    );
  }
  return NextResponse.json(next);
}
