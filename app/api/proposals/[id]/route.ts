/**
 * GET    /api/proposals/[id]  — fetch single proposal
 * PATCH  /api/proposals/[id]  — update (fields, items replace, generateShareToken)
 * DELETE /api/proposals/[id]  — delete proposal
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";
import crypto from "crypto";

const proposalInclude = {
  items: { orderBy: { order: "asc" as const } },
  project: {
    select: {
      id: true,
      name: true,
      color: true,
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, company: true, role: true },
          },
        },
      },
    },
  },
  client: {
    select: { id: true, name: true, email: true, company: true, role: true },
  },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const proposal = await prisma.proposal.findUnique({ where: { id }, include: proposalInclude });
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(proposal);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.title      !== undefined) updateData.title      = body.title;
  if (body.status     !== undefined) updateData.status     = body.status;
  if (body.taxRate    !== undefined) updateData.taxRate    = Number(body.taxRate);
  if (body.notes      !== undefined) updateData.notes      = body.notes || null;
  if (body.clientId   !== undefined) updateData.clientId   = body.clientId || null;
  if (body.projectId  !== undefined) updateData.projectId  = body.projectId || null;
  if (body.validUntil !== undefined) {
    updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  }

  // Generate share token if requested or if not already set and status becoming SENT
  if (body.generateShareToken || (body.status === "SENT" && !existing.shareToken)) {
    updateData.shareToken = crypto.randomBytes(32).toString("hex");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (Array.isArray(body.items)) {
      await tx.proposalItem.deleteMany({ where: { proposalId: id } });
      if (body.items.length > 0) {
        await tx.proposalItem.createMany({
          data: body.items.map((item: any, i: number) => ({
            proposalId:  id,
            description: item.description,
            quantity:    item.quantity  ?? 1,
            unitPrice:   item.unitPrice ?? 0,
            unit:        item.unit      ?? "Std.",
            order:       i,
          })),
        });
      }
    }

    return tx.proposal.update({
      where: { id },
      data: updateData,
      include: proposalInclude,
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.proposal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
