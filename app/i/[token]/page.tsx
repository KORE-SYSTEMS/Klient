"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, FileText } from "lucide-react";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  order: number;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  status: string;
  taxRate: number;
  dueDate: string | null;
  issuedAt: string;
  paidAt: string | null;
  notes: string | null;
  items: InvoiceItem[];
  project: { id: string; name: string; color: string | null };
}

interface Workspace {
  name: string;
  logo: string | null;
  primaryColor: string | null;
  companyName: string | null;
  companyAddress: string | null;
  companyTaxId: string | null;
  companyIban: string | null;
  currency: string;
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [invoice,   setInvoice]   = useState<Invoice | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  useEffect(() => {
    fetch(`/api/public/invoice/${token}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setInvoice(data.invoice);
        setWorkspace(data.workspace);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Rechnung wird geladen…</p>
      </div>
    );
  }

  if (notFound || !invoice || !workspace) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">Rechnung nicht gefunden</h1>
        <p className="text-sm text-gray-500 max-w-xs">
          Diese Rechnung ist nicht verfügbar oder der Link ist ungültig.
        </p>
      </div>
    );
  }

  const primaryColor = workspace.primaryColor ?? "#E8520A";
  const currency     = workspace.currency ?? "EUR";
  const netto        = invoice.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax          = netto * invoice.taxRate / 100;
  const brutto       = netto + tax;

  const statusLabel: Record<string, string> = {
    SENT: "Versendet", PAID: "Bezahlt", DRAFT: "Entwurf", OVERDUE: "Überfällig", CANCELLED: "Storniert",
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .invoice-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-10 px-4" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {/* Print button */}
        <div className="no-print max-w-3xl mx-auto mb-4 flex justify-end">
          <button
            onClick={() => window.print()}
            style={{ backgroundColor: primaryColor }}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <Printer className="h-4 w-4" />
            Drucken / Als PDF
          </button>
        </div>

        {/* Invoice card */}
        <div className="invoice-card max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div style={{ backgroundColor: primaryColor }} className="px-10 py-8">
            <div className="flex items-start justify-between">
              <div>
                {workspace.logo ? (
                  <img src={workspace.logo} alt="Logo" className="h-10 mb-2 object-contain" />
                ) : (
                  <h2 className="text-2xl font-bold text-white">{workspace.companyName ?? workspace.name}</h2>
                )}
                {workspace.logo && (
                  <p className="text-white/80 text-sm">{workspace.companyName ?? workspace.name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs uppercase tracking-wider font-semibold">Rechnung</p>
                <p className="text-white text-xl font-bold">{invoice.number}</p>
                <span
                  className="inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  {statusLabel[invoice.status] ?? invoice.status}
                </span>
              </div>
            </div>
          </div>

          {/* Meta info bar */}
          <div className="px-10 py-5 border-b border-gray-100 grid grid-cols-3 gap-6 bg-gray-50/50">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Ausgestellt</p>
              <p className="text-sm font-semibold text-gray-800">{fmtDate(invoice.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Fällig am</p>
              <p className="text-sm font-semibold text-gray-800">{fmtDate(invoice.dueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Projekt</p>
              <p className="text-sm font-semibold text-gray-800">{invoice.project.name}</p>
            </div>
          </div>

          {/* Company info */}
          {(workspace.companyName || workspace.companyAddress) && (
            <div className="px-10 py-5 border-b border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Von</p>
              <p className="text-sm font-semibold text-gray-800">{workspace.companyName ?? workspace.name}</p>
              {workspace.companyAddress && (
                <p className="text-sm text-gray-500 whitespace-pre-line">{workspace.companyAddress}</p>
              )}
              {workspace.companyTaxId && (
                <p className="text-xs text-gray-400 mt-1">USt-IdNr.: {workspace.companyTaxId}</p>
              )}
            </div>
          )}

          {/* Title */}
          <div className="px-10 pt-8 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.title}</h1>
          </div>

          {/* Items table */}
          <div className="px-10 pb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="pb-2 text-left text-xs text-gray-400 uppercase tracking-wider font-semibold">Beschreibung</th>
                  <th className="pb-2 text-right text-xs text-gray-400 uppercase tracking-wider font-semibold">Menge</th>
                  <th className="pb-2 text-right text-xs text-gray-400 uppercase tracking-wider font-semibold">Einzelpreis</th>
                  <th className="pb-2 text-right text-xs text-gray-400 uppercase tracking-wider font-semibold">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-3 text-gray-800 font-medium pr-4">{item.description}</td>
                    <td className="py-3 text-right text-gray-600 whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 text-right text-gray-600 whitespace-nowrap">
                      {fmt(item.unitPrice, currency)}
                    </td>
                    <td className="py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {fmt(item.quantity * item.unitPrice, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-10 pb-8">
            <div className="ml-auto max-w-xs rounded-xl p-5" style={{ backgroundColor: "#f9fafb" }}>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Netto</span>
                <span className="font-medium">{fmt(netto, currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mb-3 pb-3 border-b border-gray-200">
                <span>MwSt. {invoice.taxRate}%</span>
                <span className="font-medium">{fmt(tax, currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-gray-900">Brutto</span>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>{fmt(brutto, currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-10 pb-6">
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Anmerkungen</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* Payment info */}
          {workspace.companyIban && (
            <div className="px-10 pb-8">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Zahlungsinformationen</p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">IBAN:</span> {workspace.companyIban}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-semibold">Verwendungszweck:</span> {invoice.number}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-10 py-5 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">
              {workspace.companyName ?? workspace.name}
              {workspace.companyTaxId ? ` · USt-IdNr.: ${workspace.companyTaxId}` : ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
