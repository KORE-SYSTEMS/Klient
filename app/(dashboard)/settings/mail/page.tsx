"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Loader2,
  Mail,
  Server,
  Send,
  FileText,
  Receipt,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Default templates ────────────────────────────────────────────────────────

const DEFAULT_INVITE_SUBJECT = "Du wurdest eingeladen – {{workspace}}";
const DEFAULT_INVITE_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Einladung</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:{{primaryColor}};padding:36px 40px;text-align:center;">
            {{logo}}<img src="{{logo}}" height="36" alt="{{workspace}}" style="display:block;margin:0 auto 12px;max-height:36px;">{{/logo}}
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">{{workspace}}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Hallo{{name}}, {{name}}!{{/name}}</h2>
            <p style="margin:0 0 24px;color:#6b7280;line-height:1.6;">
              Du wurdest eingeladen, dem Workspace <strong style="color:#111827;">{{workspace}}</strong> beizutreten.
              Klicke auf den Button unten, um deine Einladung anzunehmen.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 32px;">
                  <a href="{{inviteLink}}"
                     style="display:inline-block;background:{{primaryColor}};color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.1px;">
                    Einladung annehmen →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Falls du diese Einladung nicht erwartest hast, kannst du sie einfach ignorieren.<br>
              Der Link ist 7 Tage gültig.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© {{workspace}} · Alle Rechte vorbehalten</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const DEFAULT_INVOICE_SUBJECT = "Rechnung {{invoiceNumber}} von {{workspace}}";
const DEFAULT_INVOICE_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rechnung</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:{{primaryColor}};padding:36px 40px;text-align:center;">
            {{logo}}<img src="{{logo}}" height="36" alt="{{workspace}}" style="display:block;margin:0 auto 12px;max-height:36px;">{{/logo}}
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">{{workspace}}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">Neue Rechnung</h2>
            <p style="margin:0 0 28px;color:#6b7280;">Rechnungsnummer: <strong style="color:#111827;">{{invoiceNumber}}</strong></p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Position</td>
                <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;text-align:right;">Betrag</td>
              </tr>
              <tr>
                <td style="padding:16px;color:#111827;border-top:1px solid #f0f0f0;">{{invoiceTitle}}</td>
                <td style="padding:16px;color:#111827;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">{{amount}}</td>
              </tr>
            </table>

            <p style="margin:0 0 28px;color:#6b7280;font-size:14px;">
              Fälligkeitsdatum: <strong style="color:#111827;">{{dueDate}}</strong>
            </p>

            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Bei Fragen stehe ich jederzeit zur Verfügung.<br>
              Vielen Dank für Ihr Vertrauen!
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© {{workspace}} · Alle Rechte vorbehalten</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const DEFAULT_UPDATE_SUBJECT = "Neues Update: {{projectName}} – {{workspace}}";
const DEFAULT_UPDATE_HTML = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Projekt-Update</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:{{primaryColor}};padding:36px 40px;text-align:center;">
            {{logo}}<img src="{{logo}}" height="36" alt="{{workspace}}" style="display:block;margin:0 auto 12px;max-height:36px;">{{/logo}}
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">{{workspace}}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:{{primaryColor}};text-transform:uppercase;letter-spacing:0.5px;">Projekt-Update</p>
            <h2 style="margin:0 0 24px;font-size:20px;color:#111827;">{{projectName}}</h2>
            <div style="background:#f9fafb;border-left:4px solid {{primaryColor}};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0;color:#374151;line-height:1.7;">{{updateContent}}</p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="{{projectLink}}"
                     style="display:inline-block;background:{{primaryColor}};color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
                    Projekt öffnen →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #f0f0f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© {{workspace}} · Alle Rechte vorbehalten</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES = [
  {
    key: "invite",
    label: "Einladung",
    icon: Mail,
    description: "Wird versendet, wenn ein neuer Nutzer eingeladen wird.",
    subjectKey: "inviteEmailSubject",
    templateKey: "inviteEmailTemplate",
    defaultSubject: DEFAULT_INVITE_SUBJECT,
    defaultHtml: DEFAULT_INVITE_HTML,
    variables: [
      { name: "{{inviteLink}}", desc: "Einladungslink" },
      { name: "{{name}}", desc: "Name des Eingeladenen" },
      { name: "{{workspace}}", desc: "Workspace-Name" },
      { name: "{{primaryColor}}", desc: "Primärfarbe als Hex" },
      { name: "{{logo}}", desc: "Logo-URL" },
    ],
    preview: {
      inviteLink: "#",
      name: "Max Mustermann",
      workspace: "Mein Workspace",
      primaryColor: "#E8520A",
      logo: "",
    },
  },
  {
    key: "invoice",
    label: "Rechnung",
    icon: Receipt,
    description: "Wird versendet, wenn eine Rechnung an den Kunden geschickt wird.",
    subjectKey: "invoiceEmailSubject",
    templateKey: "invoiceEmailTemplate",
    defaultSubject: DEFAULT_INVOICE_SUBJECT,
    defaultHtml: DEFAULT_INVOICE_HTML,
    variables: [
      { name: "{{invoiceNumber}}", desc: "Rechnungsnummer" },
      { name: "{{invoiceTitle}}", desc: "Rechnungstitel" },
      { name: "{{amount}}", desc: "Gesamtbetrag" },
      { name: "{{dueDate}}", desc: "Fälligkeitsdatum" },
      { name: "{{clientName}}", desc: "Kundenname" },
      { name: "{{workspace}}", desc: "Workspace-Name" },
      { name: "{{primaryColor}}", desc: "Primärfarbe als Hex" },
      { name: "{{logo}}", desc: "Logo-URL" },
    ],
    preview: {
      invoiceNumber: "2025-001",
      invoiceTitle: "Webseite Relaunch – Phase 1",
      amount: "2.400,00 €",
      dueDate: "30.05.2025",
      clientName: "Max Mustermann",
      workspace: "Mein Workspace",
      primaryColor: "#E8520A",
      logo: "",
    },
  },
  {
    key: "update",
    label: "Projekt-Update",
    icon: FileText,
    description: "Wird versendet, wenn ein neues Projekt-Update gepostet wird.",
    subjectKey: "updateEmailSubject",
    templateKey: "updateEmailTemplate",
    defaultSubject: DEFAULT_UPDATE_SUBJECT,
    defaultHtml: DEFAULT_UPDATE_HTML,
    variables: [
      { name: "{{projectName}}", desc: "Projektname" },
      { name: "{{updateContent}}", desc: "Inhalt des Updates" },
      { name: "{{projectLink}}", desc: "Link zum Projekt" },
      { name: "{{workspace}}", desc: "Workspace-Name" },
      { name: "{{primaryColor}}", desc: "Primärfarbe als Hex" },
      { name: "{{logo}}", desc: "Logo-URL" },
    ],
    preview: {
      projectName: "Website Relaunch",
      updateContent: "Phase 2 ist abgeschlossen. Alle Seiten sind live und getestet.",
      projectLink: "#",
      workspace: "Mein Workspace",
      primaryColor: "#E8520A",
      logo: "",
    },
  },
] as const;

type TemplateKey = typeof TEMPLATES[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPreview(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(k, v);
  }
  // Strip logo block if empty
  result = result.replace(/\{\{logo\}\}[\s\S]*?\{\{\/logo\}\}/g, "");
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface MailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  inviteEmailSubject: string;
  inviteEmailTemplate: string;
  invoiceEmailSubject: string;
  invoiceEmailTemplate: string;
  updateEmailSubject: string;
  updateEmailTemplate: string;
  // needed for preview substitution
  name: string;
  primaryColor: string;
  logo: string;
}

export default function MailSettingsPage() {
  const { data: session } = useSession();
  const router            = useRouter();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [testing,   setTesting]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [activeTab, setActiveTab] = useState<"smtp" | TemplateKey>("smtp");
  const [preview,   setPreview]   = useState<TemplateKey | null>(null);

  const [s, setS] = useState<MailSettings>({
    smtpHost: "", smtpPort: 587, smtpUser: "", smtpPass: "", smtpFrom: "",
    inviteEmailSubject: "", inviteEmailTemplate: "",
    invoiceEmailSubject: "", invoiceEmailTemplate: "",
    updateEmailSubject: "", updateEmailTemplate: "",
    name: "Klient", primaryColor: "#E8520A", logo: "",
  });

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") { router.push("/dashboard"); return; }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setS({
          smtpHost:             data.smtpHost             || "",
          smtpPort:             data.smtpPort             || 587,
          smtpUser:             data.smtpUser             || "",
          smtpPass:             data.smtpPass             || "",
          smtpFrom:             data.smtpFrom             || "",
          inviteEmailSubject:   data.inviteEmailSubject   || "",
          inviteEmailTemplate:  data.inviteEmailTemplate  || "",
          invoiceEmailSubject:  data.invoiceEmailSubject  || "",
          invoiceEmailTemplate: data.invoiceEmailTemplate || "",
          updateEmailSubject:   data.updateEmailSubject   || "",
          updateEmailTemplate:  data.updateEmailTemplate  || "",
          name:                 data.name                 || "Klient",
          primaryColor:         data.primaryColor         || "#E8520A",
          logo:                 data.logo                 || "",
        });
        setLoading(false);
      });
  }, [session, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    if (res.ok) toast({ title: "Mail-Einstellungen gespeichert", variant: "success" });
    else        toast({ title: "Fehler beim Speichern", variant: "destructive" });
  }

  async function testSmtp() {
    if (!s.smtpHost || !s.smtpUser) {
      toast({ title: "Bitte zuerst SMTP konfigurieren", variant: "destructive" });
      return;
    }
    setTesting(true);
    // Save first so API can use current values
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    const res = await fetch("/api/settings/test-smtp", { method: "POST" });
    setTesting(false);
    if (res.ok) toast({ title: "Test-E-Mail gesendet ✓", description: `An ${s.smtpFrom}`, variant: "success" });
    else {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Verbindung fehlgeschlagen", description: data.error || "SMTP-Fehler", variant: "destructive" });
    }
  }

  if (loading) return <div className="text-muted-foreground p-6">Lade Einstellungen…</div>;

  const tabs = [
    { id: "smtp" as const, label: "SMTP", icon: Server },
    ...TEMPLATES.map((t) => ({ id: t.key as TemplateKey, label: t.label, icon: t.icon })),
  ];

  const activeTemplate = TEMPLATES.find((t) => t.key === activeTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Mail</h1>
        <p className="text-muted-foreground">SMTP-Verbindung und E-Mail-Vorlagen konfigurieren</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── SMTP ── */}
        {activeTab === "smtp" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verbindung</CardTitle>
                <CardDescription>
                  Konfiguriere deinen Mailserver. Ohne SMTP werden keine automatischen E-Mails versendet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input value={s.smtpHost} onChange={(e) => setS({ ...s, smtpHost: e.target.value })}
                      placeholder="smtp.example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input type="number" value={s.smtpPort}
                      onChange={(e) => setS({ ...s, smtpPort: parseInt(e.target.value) || 587 })} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Benutzername</Label>
                    <Input value={s.smtpUser} onChange={(e) => setS({ ...s, smtpUser: e.target.value })}
                      placeholder="user@example.com" autoComplete="off" />
                  </div>
                  <div className="space-y-2">
                    <Label>Passwort</Label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={s.smtpPass}
                        onChange={(e) => setS({ ...s, smtpPass: e.target.value })}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Absender-Adresse (From)</Label>
                  <Input type="email" value={s.smtpFrom}
                    onChange={(e) => setS({ ...s, smtpFrom: e.target.value })}
                    placeholder="noreply@yourdomain.com" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verbindung testen</CardTitle>
                <CardDescription>
                  Sendet eine Test-E-Mail an die Absender-Adresse, um die Verbindung zu prüfen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" variant="outline" onClick={testSmtp} disabled={testing || !s.smtpHost}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test-E-Mail senden
                </Button>
                {!s.smtpHost && (
                  <p className="mt-2 text-xs text-muted-foreground">SMTP Host muss zuerst konfiguriert werden.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Template ── */}
        {activeTemplate && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-muted-foreground max-w-xl">{activeTemplate.description}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => setPreview(activeTemplate.key as TemplateKey)}
              >
                <Eye className="h-4 w-4" />
                Vorschau
              </Button>
            </div>

            {/* Variables */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verfügbare Platzhalter</p>
              <div className="flex flex-wrap gap-2">
                {activeTemplate.variables.map((v) => (
                  <div key={v.name} className="flex items-center gap-1.5 rounded-md bg-background border px-2.5 py-1">
                    <code className="text-[11px] font-mono text-primary">{v.name}</code>
                    <span className="text-[11px] text-muted-foreground">— {v.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Betreff</Label>
                  <Input
                    value={(s as any)[activeTemplate.subjectKey] || ""}
                    onChange={(e) => setS({ ...s, [activeTemplate.subjectKey]: e.target.value })}
                    placeholder={activeTemplate.defaultSubject}
                  />
                  <p className="text-xs text-muted-foreground">Leer lassen für Standard-Betreff</p>
                </div>

                <div className="space-y-2">
                  <Label>HTML-Template</Label>
                  <textarea
                    value={(s as any)[activeTemplate.templateKey] || ""}
                    onChange={(e) => setS({ ...s, [activeTemplate.templateKey]: e.target.value })}
                    rows={22}
                    placeholder="Leer lassen für das Standard-Template…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                    spellCheck={false}
                  />
                  {(s as any)[activeTemplate.templateKey] && (
                    <button
                      type="button"
                      onClick={() => setS({ ...s, [activeTemplate.templateKey]: "" })}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Auf Standard-Template zurücksetzen
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Default template hint */}
            {!(s as any)[activeTemplate.templateKey] && (
              <div className="rounded-lg border border-dashed px-4 py-3 flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Standard-Template wird verwendet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Füge oben HTML ein, um das Template anzupassen. Das Standard-Template enthält bereits dein Logo und die Primärfarbe.
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs text-primary hover:underline"
                    onClick={() => setS({ ...s, [activeTemplate.templateKey]: activeTemplate.defaultHtml })}
                  >
                    Standard-Template laden und bearbeiten →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
        </div>
      </form>

      {/* ── Preview modal ── */}
      {preview && (() => {
        const tpl = TEMPLATES.find((t) => t.key === preview)!;
        const html = (s as any)[tpl.templateKey] || tpl.defaultHtml;
        const vars = {
          ...tpl.preview,
          workspace:    s.name || tpl.preview.workspace,
          primaryColor: s.primaryColor || tpl.preview.primaryColor,
          logo:         s.logo || "",
        } as Record<string, string>;
        const rendered = renderPreview(html, vars);

        return (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-12 overflow-y-auto"
            onClick={() => setPreview(null)}
          >
            <div
              className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Vorschau — {tpl.label}</span>
                  <Badge variant="secondary" className="text-[10px]">Beispieldaten</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Rendered email */}
              <iframe
                srcDoc={rendered}
                className="w-full border-0"
                style={{ height: "600px" }}
                title="E-Mail Vorschau"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
