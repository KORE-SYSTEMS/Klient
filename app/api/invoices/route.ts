/**
 * GET  /api/invoices              — list ALL invoices (ADMIN) or own (CLIENT)
 * GET  /api/invoices?projectId=x  — list invoices for a single project
 * POST /api/invoices              — create invoice (admin/member only)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

// Minimal include for project-scoped view (no member traversal needed)
const invoiceInclude = {
  items: { orderBy: { order: "asc" as const } },
  project: { select: { id: true, name: true, color: true } },
};

// Extended include with project members so we can surface the client
const invoiceIncludeWithClient = {
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
};

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const userId    = session.user.id;
  const role      = session.user.role;

  // ── No projectId → global view ───────────────────────────────────────────
  if (!projectId) {
    // CLIENT: own invoices from their projects (drafts hidden)
    if (role === "CLIENT") {
      const memberProjectIds = (
        await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
      ).map((m) => m.projectId);

      const invoices = await prisma.invoice.findMany({
        where: { projectId: { in: memberProjectIds }, status: { not: "DRAFT" } },
        include: invoiceIncludeWithClient,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(invoices);
    }

    // MEMBER: all invoices for projects they are in
    if (role === "MEMBER") {
      const memberProjectIds = (
        await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
      ).map((m) => m.projectId);

      const invoices = await prisma.invoice.findMany({
        where: { projectId: { in: memberProjectIds } },
        include: invoiceIncludeWithClient,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(invoices);
    }

    // ADMIN: everything
    const invoices = await prisma.invoice.findMany({
      include: invoiceIncludeWithClient,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(invoices);
  }

  // ── Project-scoped view ──────────────────────────────────────────────────
  if (role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const { projectId, title, number, status, dueDate, notes, items, taxRate } = body;

  if (!projectId || !title) {
    return NextResponse.json({ error: "projectId and title are required" }, { status: 400 });
  }

  const userId = session.user.id;
  const role   = session.user.role;

  if (role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch workspace settings for defaults (prefix, taxRate)
  const workspace = await prisma.workspace.findFirst();

  const resolvedTaxRate: number =
    taxRate !== undefined && taxRate !== null
      ? Number(taxRate)
      : (workspace?.defaultTaxRate ?? 19);

  const invoiceNumber = number?.trim() || await generateInvoiceNumber(workspace?.invoicePrefix ?? "RE");

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      title,
      number: invoiceNumber,
      status: status || "DRAFT",
      taxRate: resolvedTaxRate,
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
    include: invoiceIncludeWithClient,
  });

  return NextResponse.json(invoice, { status: 201 });
}

// Workspace-aware invoice number — uses configured prefix, resets each year
async function generateInvoiceNumber(prefix: string): Promise<string> {
  const year        = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count       = await prisma.invoice.count({ where: { createdAt: { gte: startOfYear } } });
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}
