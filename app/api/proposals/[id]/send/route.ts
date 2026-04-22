/**
 * POST /api/proposals/[id]/send
 * Sends the proposal via email, updates status to SENT, generates shareToken if missing.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";
import crypto from "crypto";
import nodemailer from "nodemailer";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" as const } },
      project: {
        select: {
          id: true,
          name: true,
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      },
      client: { select: { id: true, name: true, email: true } },
    },
  });

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspace = await prisma.workspace.findFirst();
  if (!workspace?.smtpHost) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 400 });
  }

  // Resolve recipient email: explicit clientId user first, then project CLIENT member
  let recipientEmail: string | null = null;
  let recipientName: string | null  = null;

  if (proposal.client) {
    recipientEmail = proposal.client.email;
    recipientName  = proposal.client.name;
  } else if (proposal.project) {
    const clientMember = proposal.project.members.find((m) => m.user.role === "CLIENT");
    if (clientMember) {
      recipientEmail = clientMember.user.email;
      recipientName  = clientMember.user.name;
    }
  }

  if (!recipientEmail) {
    return NextResponse.json({ error: "No client email found" }, { status: 400 });
  }

  // Ensure share token exists
  const shareToken = proposal.shareToken ?? crypto.randomBytes(32).toString("hex");

  // Compute totals
  const netto  = proposal.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax    = netto * proposal.taxRate / 100;
  const brutto = netto + tax;

  const fmt = (n: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: workspace.currency ?? "EUR" }).format(n);

  const baseUrl  = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const shareUrl = `${baseUrl}/p/${shareToken}`;

  const itemRows = proposal.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity} ${item.unit}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(item.unitPrice)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmt(item.quantity * item.unitPrice)}</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <!-- Header -->
    <div style="background:${workspace.primaryColor ?? "#E8520A"};padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${workspace.companyName ?? workspace.name}</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:14px;">Angebot ${proposal.number}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">
        Hallo ${recipientName ?? recipientEmail},<br><br>
        anbei finden Sie unser Angebot <strong>${proposal.title}</strong> (${proposal.number}).
        ${proposal.validUntil ? `Das Angebot ist gültig bis <strong>${new Date(proposal.validUntil).toLocaleDateString("de-DE")}</strong>.` : ""}
      </p>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;">Beschreibung</th>
            <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;">Menge</th>
            <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;">Einzelpreis</th>
            <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:600;">Gesamt</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:right;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Netto: <strong>${fmt(netto)}</strong></p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">MwSt. ${proposal.taxRate}%: <strong>${fmt(tax)}</strong></p>
        <p style="margin:0;font-size:17px;font-weight:700;color:#111827;">Brutto: ${fmt(brutto)}</p>
      </div>

      ${proposal.notes ? `<p style="margin:0 0 24px;font-size:13px;color:#6b7280;border-left:3px solid #e5e7eb;padding-left:12px;">${proposal.notes}</p>` : ""}

      <!-- CTA -->
      <a href="${shareUrl}" style="display:inline-block;background:${workspace.primaryColor ?? "#E8520A"};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Angebot ansehen
      </a>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Oder kopieren Sie diesen Link: ${shareUrl}</p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #e5e7eb;background:#f9fafb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        ${workspace.companyName ?? workspace.name}
        ${workspace.companyAddress ? ` · ${workspace.companyAddress}` : ""}
        ${workspace.companyTaxId ? ` · USt-IdNr.: ${workspace.companyTaxId}` : ""}
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    const transporter = nodemailer.createTransport({
      host: workspace.smtpHost,
      port: workspace.smtpPort ?? 587,
      secure: (workspace.smtpPort ?? 587) === 465,
      auth: workspace.smtpUser
        ? { user: workspace.smtpUser, pass: workspace.smtpPass ?? "" }
        : undefined,
    });

    await transporter.sendMail({
      from: workspace.smtpFrom ?? workspace.smtpUser ?? "noreply@example.com",
      to:   recipientEmail,
      subject: `Angebot ${proposal.number}: ${proposal.title}`,
      html,
    });
  } catch (err) {
    console.error("Proposal email send failed:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  // Update status + shareToken
  const updated = await prisma.proposal.update({
    where: { id },
    data: {
      status:     "SENT",
      shareToken,
    },
    include: {
      items: { orderBy: { order: "asc" as const } },
      project: { select: { id: true, name: true, color: true } },
      client:  { select: { id: true, name: true, email: true, company: true, role: true } },
    },
  });

  return NextResponse.json(updated);
}
