import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AutoPrint } from "./auto-print";
import "./print.css";

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function InvoicePrintPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    redirect("/login");
  }

  const { id } = await params;
  const [invoice, workspace] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { order: "asc" } },
        project: {
          select: {
            id: true,
            name: true,
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
  const netto = invoice.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const mwst = netto * (taxRate / 100);
  const brutto = netto + mwst;

  const client = invoice.project?.members?.find((m) => m.user.role === "CLIENT")?.user;

  // Bank info (IBAN auf BIC heuristisch konvertieren wäre Overkill — wir
  // zeigen einfach was im Workspace gesetzt ist).
  const showBank = !!workspace?.companyIban;

  return (
    <div className="invoice-page">
      <AutoPrint />

      {/* Header: Sender (top) */}
      <header className="sender">
        {workspace?.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={workspace.logo} alt="Logo" className="logo" />
        )}
        <div className="sender-name">{workspace?.companyName || workspace?.name || "—"}</div>
        {workspace?.companyAddress && (
          <div className="sender-addr">
            {workspace.companyAddress.split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
        {workspace?.companyTaxId && (
          <div className="sender-meta">USt-IdNr.: {workspace.companyTaxId}</div>
        )}
      </header>

      {/* Recipient + Meta block */}
      <section className="recipient-block">
        <div className="recipient">
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
            <span className="meta-label">Rechnungsdatum:</span>
            <span>{formatDate(invoice.issuedAt)}</span>
          </div>
          {invoice.dueDate && (
            <div className="meta-row">
              <span className="meta-label">Fällig bis:</span>
              <span>{formatDate(invoice.dueDate)}</span>
            </div>
          )}
          <div className="meta-row">
            <span className="meta-label">Rechnungsnr.:</span>
            <span>{invoice.number}</span>
          </div>
        </div>
      </section>

      {/* Title */}
      <h1 className="title">Rechnung</h1>
      {invoice.title && <p className="subtitle">{invoice.title}</p>}

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
          {invoice.items.map((item, i) => (
            <tr key={item.id}>
              <td className="col-pos">{i + 1}</td>
              <td className="col-desc">{item.description}</td>
              <td className="col-qty">
                {item.quantity.toLocaleString("de-DE")} {item.unit}
              </td>
              <td className="col-price">{formatCurrency(item.unitPrice, currency)}</td>
              <td className="col-total">
                {formatCurrency(item.quantity * item.unitPrice, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="totals">
        <div className="totals-row">
          <span>Zwischensumme (netto)</span>
          <span>{formatCurrency(netto, currency)}</span>
        </div>
        {taxRate > 0 && (
          <div className="totals-row">
            <span>zzgl. {taxRate}% MwSt.</span>
            <span>{formatCurrency(mwst, currency)}</span>
          </div>
        )}
        <div className="totals-row totals-final">
          <span>Gesamtbetrag</span>
          <span>{formatCurrency(brutto, currency)}</span>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <section className="notes">
          <h2 className="notes-heading">Anmerkungen</h2>
          <p className="notes-text">{invoice.notes}</p>
        </section>
      )}

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
            an folgende Bankverbindung:
          </p>
          <div className="bank-grid">
            {workspace?.companyName && (
              <>
                <div className="bank-label">Kontoinhaber</div>
                <div>{workspace.companyName}</div>
              </>
            )}
            <div className="bank-label">IBAN</div>
            <div className="mono">{workspace.companyIban}</div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer">
        <div>{workspace?.companyName || workspace?.name}</div>
        {workspace?.companyTaxId && <div>USt-IdNr.: {workspace.companyTaxId}</div>}
      </footer>
    </div>
  );
}
