/**
 * GET  /api/invoices?projectId=xxx  — list invoices for a project
 * POST /api/invoices                — create invoice (admin/member only)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

const invoiceInclude = {
  items: { orderBy: { order: "asc" as const } },
  project: { select: { id: true, name: true, color: true } },
};

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const userId = session.user.id;
  const role   = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Clients never see invoices
  if (role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { projectId },
    include: invoiceInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { projectId, title, number, status, dueDate, notes, items } = body;

  if (!projectId || !title) {
    return NextResponse.json({ error: "projectId and title are required" }, { status: 400 });
  }

  const userId = session.user.id;
  const role   = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Auto-generate invoice number if not provided
  const invoiceNumber = number?.trim() || await generateInvoiceNumber(projectId);

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      title,
      number: invoiceNumber,
      status: status || "DRAFT",
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      items: items?.length
        ? {
            create: items.map((item: any, i: number) => ({
              description: item.description,
              quantity:    item.quantity  ?? 1,
              unitPrice:   item.unitPrice ?? 0,
              unit:        item.unit      ?? "Std.",
              order:       i,
              timeEntryId: item.timeEntryId || null,
            })),
          }
        : undefined,
    },
    include: invoiceInclude,
  });

  return NextResponse.json(invoice, { status: 201 });
}

async function generateInvoiceNumber(projectId: string): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { projectId } });
  return `${year}-${String(count + 1).padStart(3, "0")}`;
}
