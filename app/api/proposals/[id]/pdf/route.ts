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
      select: {
        number: true,
        title: true,
        client: { select: { name: true, company: true } },
      },
    }),
    prisma.workspace.findFirst({
      select: { companyName: true, name: true, logo: true, companyEmail: true },
    }),
  ]);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const senderName = workspace?.companyName || workspace?.name || "";
  const clientName = proposal.client?.company || proposal.client?.name || "";

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

    const pdfTitle = [clientName, `Angebot ${proposal.number}`].filter(Boolean).join(" – ");
    await (page as any).evaluate((t: string) => { document.title = t; }, pdfTitle);

    // Logo als Data-URI in den Header einbetten (siehe Invoice-Route).
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
      } catch { /* logo bleibt null */ }
    }

    const proposalTitle = proposal.title ? escapeHtml(proposal.title) : "";
    const proposalNumber = escapeHtml(`Angebot ${proposal.number}`);
    const headerLogoHtml = logoDataUri
      ? `<img src="${logoDataUri}" style="height: 5mm; width: auto; max-width: 35mm; object-fit: contain;" />`
      : "";

    const footerLeftParts = [senderName, workspace?.companyEmail || ""]
      .filter(Boolean)
      .map(escapeHtml);
    const footerLeft = footerLeftParts.join(' <span style="color:#c5c5c5;margin:0 4pt;">·</span> ');

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      // Kompakte Page-Margins (analog zur Invoice-Route).
      margin: { top: "18mm", right: "16mm", bottom: "14mm", left: "16mm" },
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
            padding: 4mm 0 3mm;
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
              ">${proposalTitle}</span>
            </div>
            <span style="white-space: nowrap;">${proposalNumber}</span>
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
            padding: 3mm 0 6mm;
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

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9äöüÄÖÜß -]/g, "_").trim();
    const namePart = clientName ? `${sanitize(clientName)}_` : "";
    const fileName = `Angebot-${namePart}${proposal.number.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

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
