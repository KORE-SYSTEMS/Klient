import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const notes = await prisma.clientNote.findMany({
    where: { clientId: id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const body = await request.json();
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const note = await prisma.clientNote.create({
    data: {
      clientId: id,
      authorId: session.user.id,
      title: body.title?.trim() || null,
      content: body.content.trim(),
      pinned: body.pinned ?? false,
    },
  });
  return NextResponse.json(note, { status: 201 });
}
