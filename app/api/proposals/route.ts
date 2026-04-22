/**
 * GET  /api/proposals  — list proposals (ADMIN: all, MEMBER: own projects)
 * POST /api/proposals  — create proposal with auto-generated number
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrMember, requireProjectAccess } from "@/lib/auth-guard";

const proposalInclude = {
  items: { orderBy: { order: "asc" as const } },
  project: { select: { id: true, name: true, color: true } },
};

const proposalIncludeWithClient = {
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

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;
  const role   = session.user.role;

  if (role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (role === "MEMBER") {
    const memberProjectIds = (
      await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
    ).map((m) => m.projectId);

    const proposals = await prisma.proposal.findMany({
      where: { OR: [{ projectId: { in: memberProjectIds } }, { projectId: null }] },
      include: proposalIncludeWithClient,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(proposals);
  }

  // ADMIN: everything
  const proposals = await prisma.proposal.findMany({
    include: proposalIncludeWithClient,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(proposals);
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { title, projectId, clientId, taxRate, validUntil, notes, items } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const userId = session.user.id;
  const role   = session.user.role;

  if (projectId && role !== "ADMIN") {
    const hasAccess = await requireProjectAccess(projectId, userId);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const number = await generateProposalNumber();

  const proposal = await prisma.proposal.create({
    data: {
      number,
      title,
      projectId:  projectId  || null,
      clientId:   clientId   || null,
      taxRate:    taxRate     ?? 19,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes:      notes       || null,
      items: items?.length
        ? {
            create: items.map((item: any, i: number) => ({
              description: item.description,
              quantity:    item.quantity  ?? 1,
              unitPrice:   item.unitPrice ?? 0,
              unit:        item.unit      ?? "Std.",
              order:       i,
            })),
          }
        : undefined,
    },
    include: proposalIncludeWithClient,
  });

  return NextResponse.json(proposal, { status: 201 });
}

// ── Number generation ─────────────────────────────────────────────────────────
async function generateProposalNumber(): Promise<string> {
  const workspace = await prisma.workspace.findFirst();
  const prefix    = workspace?.proposalPrefix ?? "AN";
  const year      = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count = await prisma.proposal.count({ where: { createdAt: { gte: startOfYear } } });
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}
