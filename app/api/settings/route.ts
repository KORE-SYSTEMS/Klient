import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

// GET: Fetch workspace settings
export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  // Get the first (and only) workspace record, or create a default one
  let workspace = await prisma.workspace.findFirst();

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Klient",
        primaryColor: "#E8520A",
      },
    });
  }

  return NextResponse.json(workspace);
}

// PATCH: Update workspace settings
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();

    // Get or create workspace
    let workspace = await prisma.workspace.findFirst();

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: "Klient",
          primaryColor: "#E8520A",
        },
      });
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.logo !== undefined) updateData.logo = body.logo;
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor;
    if (body.smtpHost !== undefined) updateData.smtpHost = body.smtpHost;
    if (body.smtpPort !== undefined) updateData.smtpPort = body.smtpPort;
    if (body.smtpUser !== undefined) updateData.smtpUser = body.smtpUser;
    if (body.smtpPass !== undefined) updateData.smtpPass = body.smtpPass;
    if (body.smtpFrom !== undefined) updateData.smtpFrom = body.smtpFrom;
    if (body.inviteEmailSubject   !== undefined) updateData.inviteEmailSubject   = body.inviteEmailSubject;
    if (body.inviteEmailTemplate  !== undefined) updateData.inviteEmailTemplate  = body.inviteEmailTemplate;
    if (body.invoiceEmailSubject  !== undefined) updateData.invoiceEmailSubject  = body.invoiceEmailSubject;
    if (body.invoiceEmailTemplate !== undefined) updateData.invoiceEmailTemplate = body.invoiceEmailTemplate;
    if (body.updateEmailSubject   !== undefined) updateData.updateEmailSubject   = body.updateEmailSubject;
    if (body.updateEmailTemplate  !== undefined) updateData.updateEmailTemplate  = body.updateEmailTemplate;

    // Billing fields
    if (body.companyName       !== undefined) updateData.companyName       = body.companyName;
    if (body.companyAddress    !== undefined) updateData.companyAddress    = body.companyAddress;
    if (body.companyTaxId      !== undefined) updateData.companyTaxId      = body.companyTaxId;
    if (body.companyIban           !== undefined) updateData.companyIban           = body.companyIban;
    if (body.companyAccountHolder  !== undefined) updateData.companyAccountHolder  = body.companyAccountHolder || null;
    if (body.companyEmail          !== undefined) updateData.companyEmail          = body.companyEmail || null;
    if (body.companyPhone      !== undefined) updateData.companyPhone      = body.companyPhone   || null;
    if (body.companyWebsite    !== undefined) updateData.companyWebsite    = body.companyWebsite || null;
    if (body.currency          !== undefined) updateData.currency          = body.currency;
    if (body.defaultHourlyRate !== undefined) updateData.defaultHourlyRate = body.defaultHourlyRate === "" ? null : Number(body.defaultHourlyRate);
    if (body.defaultTaxRate    !== undefined) updateData.defaultTaxRate    = Number(body.defaultTaxRate);
    if (body.invoicePrefix     !== undefined) updateData.invoicePrefix     = body.invoicePrefix;
    if (body.proposalPrefix    !== undefined) updateData.proposalPrefix    = body.proposalPrefix;
    if (body.paymentTermsDays  !== undefined) updateData.paymentTermsDays  = Number(body.paymentTermsDays);
    if (body.defaultInvoiceNotes  !== undefined) updateData.defaultInvoiceNotes  = body.defaultInvoiceNotes || null;
    if (body.defaultProposalNotes !== undefined) updateData.defaultProposalNotes = body.defaultProposalNotes || null;
    if (body.defaultInvoiceIntro  !== undefined) updateData.defaultInvoiceIntro  = body.defaultInvoiceIntro || null;
    if (body.defaultProposalIntro !== undefined) updateData.defaultProposalIntro = body.defaultProposalIntro || null;

    // Footer
    if (body.footerEnabled !== undefined) updateData.footerEnabled = Boolean(body.footerEnabled);
    if (body.privacyUrl    !== undefined) updateData.privacyUrl    = body.privacyUrl || null;
    if (body.imprintUrl    !== undefined) updateData.imprintUrl    = body.imprintUrl || null;

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update workspace settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
