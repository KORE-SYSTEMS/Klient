import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  try {
    await prisma.taskLink.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete task link:", error);
    return NextResponse.json({ error: "Failed to delete task link" }, { status: 500 });
  }
}
