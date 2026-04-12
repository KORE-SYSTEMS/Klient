import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPDATE_FLAG = path.join(process.cwd(), "uploads", ".update-requested");
const UPDATE_LOG = path.join(process.cwd(), "uploads", ".update-log");

// POST: Trigger an update by writing a flag file the updater sidecar watches
export async function POST() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    // Write flag file with timestamp — the updater sidecar picks this up
    await writeFile(
      UPDATE_FLAG,
      JSON.stringify({
        requestedAt: new Date().toISOString(),
        requestedBy: session.user.email,
      })
    );

    return NextResponse.json({
      success: true,
      message: "Update angefordert. Der Updater wird die App neu bauen und neustarten.",
    });
  } catch (error) {
    console.error("Failed to request update:", error);
    return NextResponse.json(
      { error: "Update konnte nicht angefordert werden" },
      { status: 500 }
    );
  }
}

// GET: Check update status
export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const pending = existsSync(UPDATE_FLAG);
  let log = "";

  try {
    if (existsSync(UPDATE_LOG)) {
      log = await readFile(UPDATE_LOG, "utf-8");
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ pending, log });
}
