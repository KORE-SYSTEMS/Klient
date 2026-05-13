/**
 * GET /api/invoices/[id]/pdf
 *
 * Erzeugt server-side eine PDF aus der Print-View und liefert sie direkt
 * als Buffer zurück. Browser zeigt sie inline oder lädt sie herunter.
 *
 * Nutzt Puppeteer mit Headless-Chromium. Die Print-View wird über
 * /print/invoices/[id]?raw=1 gerendert (raw=1 unterdrückt das AutoPrint
 * damit der Renderer nicht den Druck-Dialog triggert).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrMember } from "@/lib/auth-guard";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const [invoice, workspace] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      select: { number: true, title: true },
    }),
    prisma.workspace.findFirst({
      select: { companyName: true, name: true, logo: true, companyEmail: true },
    }),
  ]);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const senderName = workspace?.companyName || workspace?.name || "";

  // Auth-Cookie kopieren damit die Print-Page (eigener Server-Component-Auth-Check)
  // den User erkennt. Wir geben Puppeteer denselben Session-Cookie weiter.
  // Puppeteer läuft im SELBEN Container wie der Next.js Server.
  // Daher zeigt baseUrl auf localhost — nicht auf die externe URL des Users.
  // Cookies werden auch für localhost gesetzt (Domain muss matchen wo
  // Puppeteer hingeht, nicht wo der User herkommt).
  const port = process.env.PORT || "3000";
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetHost = "127.0.0.1";
  const targetUrl = `${baseUrl}/print/invoices/${id}?raw=1`;

  let puppeteer: typeof import("puppeteer");
  try {
    puppeteer = await import("puppeteer");
  } catch {
    return NextResponse.json(
      { error: "Puppeteer nicht installiert" },
      { status: 500 },
    );
  }

  let browser: import("puppeteer").Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      // In Docker (Alpine): /usr/bin/chromium-browser via env gesetzt.
      // Lokal: undefined → Puppeteer nutzt seine eigene Chromium-Binary.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage();

    // Session-Cookies für die Print-Page setzen.
    // Wichtig: Cookie-Domain muss zum Ziel-Host matchen wohin Puppeteer
    // geht (127.0.0.1), NICHT zum externen Host des Users. Der JWT-Inhalt
    // ist hostunabhängig und wird vom Server-side auth() korrekt verifiziert.
    const allCookies = (await cookies()).getAll();
    if (allCookies.length > 0) {
      const cookieList = allCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: targetHost,
        path: "/",
        httpOnly: false,
        secure: false,
      }));
      await page.setCookie(...cookieList);
    }

    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 30000 });

    // Kopf- und Fußzeile als HTML-Templates. Puppeteer rendert die für JEDE
    // Seite — perfekt für mehrseitige Rechnungen. Wir setzen preferCSSPageSize
    // NICHT, weil unsere CSS @page Margin auf 18mm steht und das mit dem
    // Header-Bereich kollidieren würde — stattdessen geben wir die Margin
    // explizit hier vor und der Print-Page CSS @page wird ignoriert.
    // Logo als Data-URI in den Header einbetten — Puppeteer-Header-Templates
    // laufen in einem isolierten Kontext und können URL-Resourcen oft nicht
    // zuverlässig laden. Server-seitig holen + base64-inlinen ist robust.
    let logoDataUri: string | null = null;
    if (workspace?.logo) {
      try {
        const logoSrc = workspace.logo;
        const logoUrl = logoSrc.startsWith("http")
          ? logoSrc
          : `${baseUrl}${logoSrc.startsWith("/") ? "" : "/"}${logoSrc}`;
        const r = await fetch(logoUrl);
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          const mime = r.headers.get("content-type") || "image/png";
          logoDataUri = `data:${mime};base64,${buf.toString("base64")}`;
        }
      } catch { /* logo bleibt null — Header zeigt nur Text */ }
    }

    // Header: kleines Logo + Titel der Rechnung links, Belegnummer rechts.
    // Logo-Höhe ~5mm = etwa Höhe einer Zeile Header-Text. Trennlinie sitzt
    // auf einem inneren Container mit Content-Breite (178mm).
    const invoiceTitle = invoice.title ? escapeHtml(invoice.title) : "";
    const invoiceNumber = escapeHtml(`Rechnung ${invoice.number}`);
    const headerLogoHtml = logoDataUri
      ? `<img src="${logoDataUri}" style="height: 5mm; width: auto; max-width: 35mm; object-fit: contain;" />`
      : "";

    // Footer: Firmenname + (optional) E-Mail in einer Zeile links,
    // Seitenzahlen rechts.
    const footerLeftParts = [senderName, workspace?.companyEmail || ""]
      .filter(Boolean)
      .map(escapeHtml);
    const footerLeft = footerLeftParts.join(' <span style="color:#c5c5c5;margin:0 4pt;">·</span> ');
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      // Header sitzt im oberen ~16mm der Page-Margin (9mm Padding + Text +
      // Border). Mit 28mm Top-Margin bleiben ca. 12mm sichtbare Lücke
      // zwischen Header-Trennlinie und Body-Inhalt — sauber lesbar ohne
      // verschenkte Fläche. Bottom analog 20mm für die Fußzeile.
      margin: { top: "28mm", right: "16mm", bottom: "20mm", left: "16mm" },
      headerTemplate: `
        <div style="
          width: 100%;
          padding: 0 16mm;
          box-sizing: border-box;
          font-size: 8pt;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #6a6a6a;
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8mm;
            padding: 9mm 0 3mm;
            border-bottom: 1px solid #e5e5e5;
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 4mm;
              min-width: 0;
            ">
              ${headerLogoHtml}
              <span style="
                color: #3a3a3a;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">${invoiceTitle}</span>
            </div>
            <span style="white-space: nowrap;">${invoiceNumber}</span>
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="
          width: 100%;
          padding: 0 16mm;
          box-sizing: border-box;
          font-size: 8pt;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #8a8a8a;
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8mm;
            padding: 3mm 0 12mm;
            border-top: 1px solid #e5e5e5;
          ">
            <span style="white-space: nowrap;">${footerLeft}</span>
            <span style="white-space: nowrap;">Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
          </div>
        </div>
      `,
    });

    await browser.close();
    browser = null;

    const fileName = `Rechnung-${invoice.number.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    console.error("PDF generation failed:", error);
    return NextResponse.json(
      {
        error: "PDF-Generierung fehlgeschlagen",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
