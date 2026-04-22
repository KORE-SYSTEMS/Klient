/**
 * POST /api/invoices/[id]/send
 *
 * Marks the invoice as SENT, ensures a shareToken exists, and emails
 * it to the client member of the linked project using workspace SMTP
 * settings and the configured (or built-in default) invoice email template.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";

// ── Default HTML template ─────────────────────────────────────────────────────
// Used when workspace.invoiceEmailTemplate is empty / not configured.
const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{invoiceTitle}}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: Arial, sans-serif; color: #18181b; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .header { background: {{primaryColor}}; padding: 32px 40px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .body { padding: 32px 40px; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
    th { text-align: left; padding: 8px 12px; background: #f4f4f5; font-weight: 600; color: #71717a; border-bottom: 1px solid #e4e4e7; }
    td { padding: 10px 12px; border-bottom: 1px solid #f4f4f5; }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 12px 28px; background: {{primaryColor}}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .footer { padding: 20px 40px; background: #f4f4f5; font-size: 12px; color: #71717a; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>{{workspace}}</h1>
    </div>
    <div class="body">
      <p>Hallo {{clientName}},</p>
      <p>anbei erhalten Sie die folgende Rechnung. Bitte begleichen Sie den Betrag fristgerecht.</p>
      <table>
        <tr><th>Rechnungsnummer</th><td>{{invoiceNumber}}</td></tr>
        <tr><th>Betreff</th><td>{{invoiceTitle}}</td></tr>
        <tr><th>Betrag (brutto)</th><td>{{amount}}</td></tr>
        <tr><th>Fällig am</th><td>{{dueDate}}</td></tr>
      </table>
      <p>Sie können die Rechnung über folgenden Link einsehen und herunterladen:</p>
      <div class="btn-wrap">
        <a href="{{shareLink}}" class="btn">Rechnung ansehen</a>
      </div>
      <p>Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.</p>
      <p>Mit freundlichen Grüßen,<br />{{workspace}}</p>
    </div>
    <div class="footer">{{workspace}} &mdash; Diese E-Mail wurde automatisch generiert.</div>
  </div>
</body>
</html>`;

// ── Template substitution helper ──────────────────────────────────────────────
function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value ?? ""),
    template
  );
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  // 1. Fetch invoice with items, project and project members
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" as const } },
      project: {
        select: {
          id: true,
          name: true,
          color: true,
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // 2. Fetch workspace settings
  const workspace = await prisma.workspace.findFirst();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 500 });
  }

  // 3. Validate SMTP is configured
  if (!workspace.smtpHost || !workspace.smtpUser || !workspace.smtpPass || !workspace.smtpFrom) {
    return NextResponse.json(
      { error: "SMTP is not configured. Please configure SMTP settings in workspace settings." },
      { status: 422 }
    );
  }

  // 4. Resolve client email from project members (role CLIENT)
  const clientMember = invoice.project?.members?.find((m) => m.user.role === "CLIENT");
  const clientEmail  = clientMember?.user?.email ?? workspace.smtpFrom;
  const clientName   = clientMember?.user?.name  ?? "Kunde";

  // 5. Generate shareToken if not present
  const shareToken = invoice.shareToken ?? crypto.randomBytes(32).toString("hex");
  const shareLink  = `${process.env.NEXTAUTH_URL ?? ""}/i/${shareToken}`;

  // 6. Compute totals for the email
  const net = invoice.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const tax   = net * ((invoice.taxRate ?? 19) / 100);
  const gross = net + tax;

  const formattedAmount = new Intl.NumberFormat("de-DE", {
    style:    "currency",
    currency: workspace.currency ?? "EUR",
  }).format(gross);

  const formattedDueDate = invoice.dueDate
    ? new Intl.DateTimeFormat("de-DE").format(new Date(invoice.dueDate))
    : "—";

  // 7. Update invoice: status → SENT, persist shareToken
  const updated = await prisma.invoice.update({
    where: { id },
    data:  { status: "SENT", shareToken },
    include: {
      items:   { orderBy: { order: "asc" as const } },
      project: { select: { id: true, name: true, color: true } },
    },
  });

  // 8. Build email content from workspace template or built-in default
  const rawTemplate =
    workspace.invoiceEmailTemplate?.trim() || DEFAULT_TEMPLATE;

  const templateVars: Record<string, string> = {
    invoiceNumber: invoice.number,
    invoiceTitle:  invoice.title,
    amount:        formattedAmount,
    dueDate:       formattedDueDate,
    clientName,
    workspace:     workspace.companyName || workspace.name,
    primaryColor:  workspace.primaryColor ?? "#E8520A",
    logo:          workspace.logo ?? "",
    shareLink,
  };

  const htmlBody = applyTemplate(rawTemplate, templateVars);

  const subject =
    workspace.invoiceEmailSubject?.trim() ||
    `Rechnung ${invoice.number} – ${invoice.title}`;

  // 9. Send email via nodemailer
  try {
    const transporter = nodemailer.createTransport({
      host:   workspace.smtpHost,
      port:   workspace.smtpPort ?? 587,
      secure: (workspace.smtpPort ?? 587) === 465,
      auth: {
        user: workspace.smtpUser,
        pass: workspace.smtpPass,
      },
    });

    await transporter.sendMail({
      from:    workspace.smtpFrom,
      to:      clientEmail,
      subject,
      html:    htmlBody,
    });
  } catch (err) {
    console.error("[invoice/send] Email delivery failed:", err);
    return NextResponse.json(
      { error: "Invoice marked as sent but email delivery failed.", detail: String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json(updated);
}
