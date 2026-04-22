/**
 * GET /api/public/proposal/[token]
 * No auth required. Returns a SENT or ACCEPTED proposal with workspace branding.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { shareToken: token },
    include: {
      items:   { orderBy: { order: "asc" as const } },
      project: { select: { id: true, name: true, color: true } },
      client:  { select: { id: true, name: true, email: true, company: true } },
    },
  });

  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only allow public view for SENT and ACCEPTED proposals
  const publicStatuses = ["SENT", "ACCEPTED"];
  if (!publicStatuses.includes(proposal.status)) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const workspace = await prisma.workspace.findFirst({
    select: {
      name:           true,
      logo:           true,
      primaryColor:   true,
      companyName:    true,
      companyAddress: true,
      companyTaxId:   true,
      companyIban:    true,
      currency:       true,
    },
  });

  return NextResponse.json({
    proposal,
    workspace: workspace ?? { name: "Klient", primaryColor: "#E8520A", currency: "EUR" },
  });
}
