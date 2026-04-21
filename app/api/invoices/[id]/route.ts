/**
 * GET    /api/invoices/[id]  — fetch single invoice
 * PATCH  /api/invoices/[id]  — update invoice (status, fields, items replace)
 * DELETE /api/invoices/[id]  — delete invoice
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";

const invoiceInclude = {
  items: { orderBy: { order: "asc" as const } },
  project: { select: { id: true, name: true, color: true } },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(invoice);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.title   !== undefined) updateData.title   = body.title;
  if (body.number  !== undefined) updateData.number  = body.number;
  if (body.status  !== undefined) updateData.status  = body.status;
  if (body.notes   !== undefined) updateData.notes   = body.notes || null;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.paidAt  !== undefined) updateData.paidAt  = body.paidAt ? new Date(body.paidAt)  : null;

  // If status changes to PAID, auto-set paidAt
  if (body.status === "PAID" && !existing.paidAt) {
    updateData.paidAt = new Date();
  }

  // Items replace + field update must be atomic: if the update fails after
  // delete, the old items would be lost. Wrap in a single transaction.
  const updated = await prisma.$transaction(async (tx) => {
    if (Array.isArray(body.items)) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      if (body.items.length > 0) {
        await tx.invoiceItem.createMany({
          data: body.items.map((item: any, i: number) => ({
            invoiceId:   id,
            description: item.description,
            quantity:    item.quantity  ?? 1,
            unitPrice:   item.unitPrice ?? 0,
            unit:        item.unit      ?? "Std.",
            order:       i,
            timeEntryId: item.timeEntryId || null,
          })),
        });
      }
    }

    return tx.invoice.update({
      where: { id },
      data: updateData,
      include: invoiceInclude,
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
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
