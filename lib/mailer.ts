import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export const DEFAULT_INVITE_SUBJECT = "Du wurdest eingeladen – {{workspace}}";

export const DEFAULT_INVITE_TEMPLATE = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Einladung</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:8px;overflow:hidden;border:1px solid #1f1f1f;">
          <!-- Header -->
          <tr>
            <td style="background:{{primaryColor}};padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">{{workspace}}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#f5f5f5;font-size:20px;font-weight:600;">Hallo{{#name}} {{name}}{{/name}},</h2>
              <p style="margin:0 0 24px;color:#a1a1aa;font-size:15px;line-height:1.6;">
                Du wurdest eingeladen, dem Portal <strong style="color:#f5f5f5;">{{workspace}}</strong> beizutreten.
                Klicke auf den Button unten, um dein Konto einzurichten.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="{{inviteLink}}" style="display:inline-block;background:{{primaryColor}};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600;">
                  Einladung annehmen
                </a>
              </div>
              <p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.6;">
                Oder kopiere diesen Link in deinen Browser:<br />
                <a href="{{inviteLink}}" style="color:{{primaryColor}};word-break:break-all;">{{inviteLink}}</a>
              </p>
              <p style="margin:16px 0 0;color:#52525b;font-size:12px;">
                Dieser Einladungslink ist 7 Tage gültig.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #1f1f1f;text-align:center;">
              <p style="margin:0;color:#52525b;font-size:12px;">
                Wenn du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Simple optional blocks: {{#name}} ... {{/name}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content : "";
  });
  return result;
}

export async function sendInvitationEmail({
  to,
  name,
  inviteLink,
}: {
  to: string;
  name?: string | null;
  inviteLink: string;
}) {
  const workspace = await prisma.workspace.findFirst();

  if (!workspace?.smtpHost || !workspace?.smtpUser || !workspace?.smtpPass) {
    console.warn("SMTP not configured – skipping invitation email");
    return { sent: false, reason: "SMTP not configured" };
  }

  const vars: Record<string, string> = {
    workspace: workspace.name || "Klient",
    primaryColor: workspace.primaryColor || "#E8520A",
    inviteLink,
    name: name || "",
  };

  const ws = workspace as any;

  const subject = renderTemplate(
    ws.inviteEmailSubject || DEFAULT_INVITE_SUBJECT,
    vars
  );
  const html = renderTemplate(
    ws.inviteEmailTemplate || DEFAULT_INVITE_TEMPLATE,
    vars
  );

  const transporter = nodemailer.createTransport({
    host: workspace.smtpHost,
    port: workspace.smtpPort || 587,
    secure: (workspace.smtpPort || 587) === 465,
    auth: {
      user: workspace.smtpUser,
      pass: workspace.smtpPass,
    },
  });

  await transporter.sendMail({
    from: workspace.smtpFrom || workspace.smtpUser,
    to,
    subject,
    html,
  });

  return { sent: true };
}
