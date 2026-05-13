import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AutoPrint } from "./auto-print";
import "../../invoices/[id]/print.css";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ raw?: string }>;
}

function formatCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(n);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function ProposalPrintPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    redirect("/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  const rawMode = sp.raw === "1";

  const [proposal, workspace] = await Promise.all([
    prisma.proposal.findUnique({
      where: { id },
      include: {
        items: { orderBy: { order: "asc" } },
        client: {
          select: {
            id: true, name: true, email: true,
            company: true, address: true, role: true,
          },
        },
        project: {
          select: {
            id: true, name: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true, name: true, email: true,
                    company: true, address: true, role: true,
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

  if (!proposal) notFound();

  const currency = workspace?.currency || "EUR";
  const taxRate = proposal.taxRate || 0;
  const isKleinunternehmer = taxRate === 0;
  const netto = proposal.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const mwst = netto * (taxRate / 100);
  const brutto = netto + mwst;

  // Empfänger: direkter Client > Project-Member mit Role CLIENT
  const client =
    proposal.client ??
    proposal.project?.members?.find((m) => m.user.role === "CLIENT")?.user ??
    null;

  const showBank = !!workspace?.companyIban;
  const senderName = workspace?.companyName || workspace?.name || "—";

  return (
    <div className="invoice-page">
      {!rawMode && <AutoPrint />}

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

      <section className="recipient-block">
        <div className="recipient">
          <div className="recipient-label">Angebot an</div>
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
            <span className="meta-label">Angebotsnr.</span>
            <span className="meta-value">{proposal.number}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">Angebotsdatum</span>
            <span className="meta-value">{formatDate(proposal.issuedAt)}</span>
          </div>
          {proposal.validUntil && (
            <div className="meta-row">
              <span className="meta-label">Gültig bis</span>
              <span className="meta-value">{formatDate(proposal.validUntil)}</span>
            </div>
          )}
        </div>
      </section>

      <h1 className="title">Angebot</h1>
      {proposal.title && <p className="subtitle">{proposal.title}</p>}
      {proposal.intro && <p className="intro-text">{proposal.intro}</p>}

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
          {proposal.items.map((item, i) => {
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

      {(() => {
        const notes = proposal.notes || workspace?.defaultProposalNotes || "";
        if (!notes.trim()) return null;
        return (
          <section className="notes">
            <h2 className="notes-heading">Anmerkungen</h2>
            <p className="notes-text">{notes}</p>
          </section>
        );
      })()}

      {showBank && (
        <section className="payment">
          <h2 className="notes-heading">Bankverbindung</h2>
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
