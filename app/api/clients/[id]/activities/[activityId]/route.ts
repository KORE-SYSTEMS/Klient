import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const { activityId } = await params;

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.type !== undefined) data.type = body.type;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.duration !== undefined) data.duration = body.duration ? Number(body.duration) : null;
  if (body.outcome !== undefined) data.outcome = body.outcome || null;

  const activity = await prisma.clientActivity.update({ where: { id: activityId }, data });
  return NextResponse.json(activity);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const { activityId } = await params;

  await prisma.clientActivity.delete({ where: { id: activityId } });
  return NextResponse.json({ success: true });
}
