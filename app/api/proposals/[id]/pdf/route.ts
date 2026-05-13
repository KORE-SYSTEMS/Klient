/**
 * GET /api/proposals/[id]/pdf
 *
 * Erzeugt server-side eine PDF aus der Print-View des Angebots und liefert
 * sie direkt als Buffer zurück. Analog zum Invoice-PDF-Endpoint.
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
  const [proposal, workspace] = await Promise.all([
    prisma.proposal.findUnique({
      where: { id },
      select: { number: true },
    }),
    prisma.workspace.findFirst({
      select: { companyName: true, name: true },
    }),
  ]);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const senderName = workspace?.companyName || workspace?.name || "";

  const port = process.env.PORT || "3000";
  const baseUrl = `http://127.0.0.1:${port}`;
  const targetHost = "127.0.0.1";
  const targetUrl = `${baseUrl}/print/proposals/${id}?raw=1`;

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
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage();

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

    const headerText = escapeHtml(`Angebot ${proposal.number}`);
    const footerLeft = escapeHtml(senderName);
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: "22mm", right: "16mm", bottom: "18mm", left: "16mm" },
      headerTemplate: `
        <div style="
          width: 100%;
          padding: 8mm 16mm 0;
          font-size: 8pt;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #6a6a6a;
          display: flex;
          justify-content: flex-end;
          border-bottom: 1px solid #e5e5e5;
          padding-bottom: 2mm;
        ">
          <span>${headerText}</span>
        </div>
      `,
      footerTemplate: `
        <div style="
          width: 100%;
          padding: 0 16mm 8mm;
          font-size: 8pt;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #8a8a8a;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #e5e5e5;
          padding-top: 2mm;
        ">
          <span>${footerLeft}</span>
          <span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
        </div>
      `,
    });

    await browser.close();
    browser = null;

    const fileName = `Angebot-${proposal.number.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

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
    console.error("Proposal PDF generation failed:", error);
    return NextResponse.json(
      {
        error: "PDF-Generierung fehlgeschlagen",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
