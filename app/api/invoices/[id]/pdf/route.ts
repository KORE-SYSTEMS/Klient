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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminOrMember();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { number: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auth-Cookie kopieren damit die Print-Page (eigener Server-Component-Auth-Check)
  // den User erkennt. Wir geben Puppeteer denselben Session-Cookie weiter.
  const cookieHeader = (await cookies()).getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
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
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();

    // Session-Cookie für die Auth-Prüfung der Print-Page setzen
    if (cookieHeader) {
      const cookieList = (await cookies()).getAll().map((c) => ({
        name: c.name,
        value: c.value,
        domain: request.nextUrl.hostname,
        path: "/",
      }));
      await page.setCookie(...cookieList);
    }

    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
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
