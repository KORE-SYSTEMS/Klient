/**
 * Shared types and helpers for invoices and proposals.
 */

export interface ClientUser {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  role: string;
}

export interface ProjectMemberWithUser {
  user: ClientUser;
}

export interface BillingDefaults {
  currency:             string;
  defaultHourlyRate:    number | null;
  defaultTaxRate:       number;
  invoicePrefix:        string;
  proposalPrefix:       string;
  paymentTermsDays:     number;
  defaultInvoiceNotes:  string;
  defaultProposalNotes: string;
  defaultInvoiceIntro:  string;
  defaultProposalIntro: string;
}

export const FALLBACK_DEFAULTS: BillingDefaults = {
  currency: "EUR",
  defaultHourlyRate: null,
  defaultTaxRate: 19,
  invoicePrefix: "RE",
  proposalPrefix: "AN",
  paymentTermsDays: 14,
  defaultInvoiceNotes: "",
  defaultProposalNotes: "",
  defaultInvoiceIntro: "",
  defaultProposalIntro: "",
};

export const UNITS = ["Std.", "Stk.", "Pauschal", "Tag", "Monat", "%"];

export function formatCurrency(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(n);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
