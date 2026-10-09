import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import { requireAdmin } from "@/lib/auth-guard";
import { backupPath, deleteBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** GET — download a backup archive. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { name } = await params;
  const file = backupPath(name);
  if (!file || !existsSync(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(statSync(file).size),
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}

/** DELETE — remove a backup. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { name } = await params;
  if (!deleteBackup(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
