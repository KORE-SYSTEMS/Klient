/**
 * GET /api/billing-defaults
 *
 * Returns workspace billing defaults that the invoice/proposal create-dialogs
 * need to pre-fill new entries. Read-only, available to authenticated users
 * (admin/member), so they don't need full Workspace-settings access.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";

export async function GET() {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const ws = await prisma.workspace.findFirst();
  return NextResponse.json({
    currency:             ws?.currency             ?? "EUR",
    defaultHourlyRate:    ws?.defaultHourlyRate    ?? null,
    defaultTaxRate:       ws?.defaultTaxRate       ?? 19,
    invoicePrefix:        ws?.invoicePrefix        ?? "RE",
    proposalPrefix:       ws?.proposalPrefix       ?? "AN",
    paymentTermsDays:     ws?.paymentTermsDays     ?? 14,
    defaultInvoiceNotes:  ws?.defaultInvoiceNotes  ?? "",
    defaultProposalNotes: ws?.defaultProposalNotes ?? "",
    defaultInvoiceIntro:  ws?.defaultInvoiceIntro  ?? "",
    defaultProposalIntro: ws?.defaultProposalIntro ?? "",
  });
}
