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
      select: { companyName: true, name: true },
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
    // Header: Titel der Rechnung links, Belegnummer rechts. Trennlinie ist
    // NICHT am äußeren div (sonst läuft sie über die ganze A4-Breite),
    // sondern an einem inneren Container, der die gleiche Content-Breite
    // hat wie der Body (210mm − 2×16mm Margin = 178mm).
    const invoiceTitle = invoice.title ? escapeHtml(invoice.title) : "";
    const invoiceNumber = escapeHtml(`Rechnung ${invoice.number}`);
    const footerLeft = escapeHtml(senderName);
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      // Großzügige Margins: oben/unten je ~32-28mm, damit zwischen
      // Header-Trennlinie und Body-Content sowie Body-Content und
      // Footer-Trennlinie eindeutig Luft bleibt. Verhindert dass
      // Section-Headings wie "Zahlungsinformation" oder die Totals-Box
      // direkt unter der Header-Linie kleben.
      margin: { top: "34mm", right: "16mm", bottom: "28mm", left: "16mm" },
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
            align-items: baseline;
            gap: 8mm;
            padding: 10mm 0 2.5mm;
            border-bottom: 1px solid #e5e5e5;
          ">
            <span style="
              color: #3a3a3a;
              font-weight: 500;
              max-width: 110mm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            ">${invoiceTitle}</span>
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
            padding: 2.5mm 0 10mm;
            border-top: 1px solid #e5e5e5;
          ">
            <span>${footerLeft}</span>
            <span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
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
