import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AutoPrint } from "./auto-print";
import "./print.css";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ raw?: string }>;
}

function formatCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(n);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeriod(from: Date | null, to: Date | null): string {
  if (!from) return "—";
  if (!to || from.toDateString() === to.toDateString()) return formatDate(from);
  return `${formatDate(from)} – ${formatDate(to)}`;
}

export default async function InvoicePrintPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    redirect("/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  // `?raw=1` deaktiviert AutoPrint — wird vom Puppeteer-Renderer benutzt,
  // damit er nicht den Print-Dialog triggert sondern die Page ruhig zu PDF
  // konvertiert.
  const rawMode = sp.raw === "1";
  const [invoice, workspace] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { order: "asc" } },
        project: {
          select: {
            id: true,
            name: true,
            tasks: {
              select: {
                timeEntries: {
                  select: { startedAt: true, stoppedAt: true },
                  where: { stoppedAt: { not: null } },
                  orderBy: { startedAt: "asc" },
                },
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    company: true,
                    address: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.workspace.findFirst(),
  ]);

  if (!invoice) notFound();

  const currency = workspace?.currency || "EUR";
  const taxRate = invoice.taxRate || 0;
  const isKleinunternehmer = taxRate === 0;
  const netto = invoice.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const mwst = netto * (taxRate / 100);
  const brutto = netto + mwst;

  const client = invoice.project?.members?.find((m) => m.user.role === "CLIENT")?.user;

  // Leistungszeitraum: min/max der Time-Entries im Projekt → fallback Rechnungsmonat
  let periodFrom: Date | null = null;
  let periodTo: Date | null = null;
  for (const task of invoice.project?.tasks ?? []) {
    for (const te of task.timeEntries) {
      const s = new Date(te.startedAt);
      const e = te.stoppedAt ? new Date(te.stoppedAt) : s;
      if (!periodFrom || s < periodFrom) periodFrom = s;
      if (!periodTo || e > periodTo) periodTo = e;
    }
  }
  // Fallback: Rechnungsmonat
  if (!periodFrom) {
    const issued = new Date(invoice.issuedAt);
    periodFrom = new Date(issued.getFullYear(), issued.getMonth(), 1);
    periodTo = new Date(issued.getFullYear(), issued.getMonth() + 1, 0);
  }

  const showBank = !!workspace?.companyIban;
  const senderName = workspace?.companyName || workspace?.name || "—";

  return (
    <div className="invoice-page">
      {!rawMode && <AutoPrint />}

      {/* Top stripe: Logo links + Absender rechts.
          Bewusst kompakt gehalten — Kontaktangaben (Mail/Tel/Web) erscheinen
          als dezente Meta-Zeile darunter, USt-IdNr. ist mit drin damit der
          Block nicht aufgebläht wird. */}
      <header className="top-stripe">
        <div className="logo-block">
          {workspace?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workspace.logo} alt="Logo" className="logo" />
          )}
        </div>
        <div className="sender-block">
          <div className="sender-name">{senderName}</div>
          {workspace?.companyAddress && (
            <div className="sender-addr">
              {workspace.companyAddress.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          {(workspace?.companyEmail || workspace?.companyPhone || workspace?.companyWebsite) && (
            <div className="sender-contact">
              {workspace?.companyEmail && <span>{workspace.companyEmail}</span>}
              {workspace?.companyPhone && <span>{workspace.companyPhone}</span>}
              {workspace?.companyWebsite && (
                <span>{workspace.companyWebsite.replace(/^https?:\/\//, "")}</span>
              )}
            </div>
          )}
          {workspace?.companyTaxId && (
            <div className="sender-meta">USt-IdNr./Steuer-Nr.: {workspace.companyTaxId}</div>
          )}
        </div>
      </header>

      {/* Empfänger + Rechnungs-Meta */}
      <section className="recipient-block">
        <div className="recipient">
          <div className="recipient-label">Rechnung an</div>
          {client ? (
            <>
              {client.company && <div className="recipient-line bold">{client.company}</div>}
              {client.name && <div className="recipient-line">{client.name}</div>}
              {client.address && (
                <div className="recipient-addr">
                  {client.address.split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
              {client.email && !client.email.startsWith("placeholder-") && (
                <div className="recipient-line muted">{client.email}</div>
              )}
            </>
          ) : (
            <div className="recipient-line muted">Kein Empfänger zugeordnet</div>
          )}
        </div>
        <div className="meta">
          <div className="meta-row">
            <span className="meta-label">Rechnungsnr.</span>
            <span className="meta-value">{invoice.number}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Rechnungsdatum</span>
            <span className="meta-value">{formatDate(invoice.issuedAt)}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Leistungszeitraum</span>
            <span className="meta-value">{formatPeriod(periodFrom, periodTo)}</span>
          </div>
          {invoice.dueDate && (
            <div className="meta-row">
              <span className="meta-label">Fällig bis</span>
              <span className="meta-value">{formatDate(invoice.dueDate)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Title */}
      <h1 className="title">Rechnung</h1>
      {invoice.title && <p className="subtitle">{invoice.title}</p>}
      {invoice.intro && <p className="intro-text">{invoice.intro}</p>}

      {/* Items table */}
      <table className="items">
        <thead>
          <tr>
            <th className="col-pos">Pos.</th>
            <th className="col-desc">Leistung</th>
            <th className="col-qty">Menge</th>
            <th className="col-price">Einzelpreis</th>
            <th className="col-total">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => {
            // Erste Zeile = Titel (bold), Rest = Zeit-Tracking-Notizen (dezent)
            const lines = (item.description || "").split("\n");
            const titleLine = lines[0] || "";
            const subLines = lines.slice(1)
              .map((l) => l.replace(/^[•·\-]\s*/, "").trim())
              .filter(Boolean);
            return (
              <tr key={item.id}>
                <td className="col-pos">{i + 1}</td>
                <td className="col-desc">
                  <div className="item-title">{titleLine}</div>
                  {subLines.length > 0 && (
                    <div className="item-sub">
                      {subLines.map((line, j) => (
                        <div key={j}>{line}</div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="col-qty">
                  {item.quantity.toLocaleString("de-DE", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {item.unit}
                </td>
                <td className="col-price">{formatCurrency(item.unitPrice, currency)}</td>
                <td className="col-total">
                  {formatCurrency(item.quantity * item.unitPrice, currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="totals">
        {!isKleinunternehmer ? (
          <>
            <div className="totals-row">
              <span>Zwischensumme (netto)</span>
              <span>{formatCurrency(netto, currency)}</span>
            </div>
            <div className="totals-row">
              <span>zzgl. {taxRate}% MwSt.</span>
              <span>{formatCurrency(mwst, currency)}</span>
            </div>
          </>
        ) : (
          <div className="totals-row">
            <span>Zwischensumme</span>
            <span>{formatCurrency(netto, currency)}</span>
          </div>
        )}
        <div className="totals-row totals-final">
          <span>Gesamtbetrag</span>
          <span>{formatCurrency(brutto, currency)}</span>
        </div>
      </div>

      {/* Notes: invoice-eigene Notizen oder Fallback auf Workspace-Default
          aus den Abrechnungseinstellungen (für ältere Rechnungen, die noch
          ohne Default-Notes erstellt wurden). */}
      {(() => {
        const notes = invoice.notes || workspace?.defaultInvoiceNotes || "";
        if (!notes.trim()) return null;
        return (
          <section className="notes">
            <h2 className="notes-heading">Anmerkungen</h2>
            <p className="notes-text">{notes}</p>
          </section>
        );
      })()}

      {/* Payment */}
      {showBank && (
        <section className="payment">
          <h2 className="notes-heading">Zahlungsinformation</h2>
          <p className="notes-text">
            Bitte überweisen Sie den Gesamtbetrag von{" "}
            <strong>{formatCurrency(brutto, currency)}</strong>
            {workspace?.paymentTermsDays
              ? ` innerhalb von ${workspace.paymentTermsDays} Tagen `
              : " "}
            unter Angabe der Rechnungsnummer{" "}
            <strong>{invoice.number}</strong> an folgende Bankverbindung:
          </p>
          <div className="bank-grid">
            {senderName && (
              <>
                <div className="bank-label">Kontoinhaber</div>
                <div>{senderName}</div>
              </>
            )}
            <div className="bank-label">IBAN</div>
            <div className="mono">{workspace.companyIban}</div>
          </div>
        </section>
      )}

      {/* Footer mit Pflichtangaben */}
      <footer className="footer">
        <div className="footer-line">
          <strong>{senderName}</strong>
          {workspace?.companyAddress && (
            <> · {workspace.companyAddress.replace(/\n/g, ", ")}</>
          )}
        </div>
        {workspace?.companyTaxId && (
          <div className="footer-line">USt-IdNr./Steuer-Nr.: {workspace.companyTaxId}</div>
        )}
      </footer>
    </div>
  );
}
