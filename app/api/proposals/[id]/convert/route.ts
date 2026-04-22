/**
 * POST /api/proposals/[id]/convert
 * Converts a proposal to an invoice.
 * - Creates Invoice with copied fields + items
 * - Sets proposal status to ACCEPTED
 * - Returns the new invoice
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" as const } } },
  });

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!proposal.projectId) {
    return NextResponse.json({ error: "Proposal has no associated project" }, { status: 400 });
  }

  // Generate invoice number
  const workspace   = await prisma.workspace.findFirst();
  const prefix      = workspace?.invoicePrefix ?? "RE";
  const year        = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count = await prisma.invoice.count({ where: { createdAt: { gte: startOfYear } } });
  const invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;

  // Compute due date from workspace payment terms
  const paymentDays = workspace?.paymentTermsDays ?? 14;
  const dueDate     = new Date();
  dueDate.setDate(dueDate.getDate() + paymentDays);

  const [invoice] = await prisma.$transaction([
    prisma.invoice.create({
      data: {
        number:    invoiceNumber,
        title:     proposal.title,
        projectId: proposal.projectId,
        taxRate:   proposal.taxRate,
        notes:     proposal.notes || null,
        status:    "DRAFT",
        dueDate,
        items: proposal.items.length
          ? {
              create: proposal.items.map((item, i) => ({
                description: item.description,
                quantity:    item.quantity,
                unitPrice:   item.unitPrice,
                unit:        item.unit,
                order:       i,
              })),
            }
          : undefined,
      },
      include: {
        items:   { orderBy: { order: "asc" as const } },
        project: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.proposal.update({
      where: { id },
      data:  { status: "ACCEPTED" },
    }),
  ]);

  return NextResponse.json(invoice, { status: 201 });
}
