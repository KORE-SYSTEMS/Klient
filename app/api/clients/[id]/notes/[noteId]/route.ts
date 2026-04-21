import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const { noteId } = await params;

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title || null;
  if (body.content !== undefined) data.content = body.content;
  if (body.pinned !== undefined) data.pinned = body.pinned;

  const note = await prisma.clientNote.update({ where: { id: noteId }, data });
  return NextResponse.json(note);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const { noteId } = await params;

  await prisma.clientNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
