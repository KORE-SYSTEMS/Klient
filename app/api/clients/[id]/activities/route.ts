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

  const activities = await prisma.clientActivity.findMany({
    where: { clientId: id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(activities);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const body = await request.json();
  if (!body.title?.trim() || !body.type) {
    return NextResponse.json({ error: "Title and type required" }, { status: 400 });
  }

  const activity = await prisma.clientActivity.create({
    data: {
      clientId: id,
      authorId: session.user.id,
      type: body.type,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      date: body.date ? new Date(body.date) : new Date(),
      duration: body.duration ? Number(body.duration) : null,
      outcome: body.outcome || null,
    },
  });
  return NextResponse.json(activity, { status: 201 });
}
