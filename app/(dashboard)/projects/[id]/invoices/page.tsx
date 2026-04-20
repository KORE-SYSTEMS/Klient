"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Receipt,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  Send,
  X,
  ChevronDown,
  Euro,
  FileText,
  AlertCircle,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  order?: number;
  timeEntryId?: string | null;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  status: string;
  dueDate?: string | null;
  issuedAt: string;
  paidAt?: string | null;
  notes?: string | null;
  projectId: string;
  items: InvoiceItem[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.FC<{ className?: string }> }> = {
  DRAFT:     { label: "Entwurf",      class: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",           icon: FileText },
  SENT:      { label: "Versendet",    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",           icon: Send },
  PAID:      { label: "Bezahlt",      class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  CANCELLED: { label: "Storniert",    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",               icon: X },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cfg.class)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function calcTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

const UNITS = ["Std.", "Stk.", "Pauschal", "Tag", "Monat", "%"];

const EMPTY_ITEM = (): InvoiceItem => ({ description: "", quantity: 1, unitPrice: 0, unit: "Std." });

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  // Form state
  const [formTitle,   setFormTitle]   = useState("");
  const [formNumber,  setFormNumber]  = useState("");
  const [formStatus,  setFormStatus]  = useState("DRAFT");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes,   setFormNotes]   = useState("");
  const [formItems,   setFormItems]   = useState<InvoiceItem[]>([EMPTY_ITEM()]);

  const fetchInvoices = useCallback(async () => {
    const res = await fetch(`/api/invoices?projectId=${projectId}`);
    if (res.ok) setInvoices(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Clients can't access this page
  if (isClient) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-muted-foreground text-sm">Kein Zugriff</p>
      </div>
    );
  }

  function openDialog(invoice: Invoice | null) {
    setEditInvoice(invoice);
    if (invoice) {
      setFormTitle(invoice.title);
      setFormNumber(invoice.number);
      setFormStatus(invoice.status);
      setFormDueDate(invoice.dueDate ? invoice.dueDate.split("T")[0] : "");
      setFormNotes(invoice.notes || "");
      setFormItems(invoice.items.length ? invoice.items : [EMPTY_ITEM()]);
    } else {
      setFormTitle("");
      setFormNumber("");
      setFormStatus("DRAFT");
      setFormDueDate("");
      setFormNotes("");
      setFormItems([EMPTY_ITEM()]);
    }
    setDialogOpen(true);
  }

  function addItem() {
    setFormItems((prev) => [...prev, EMPTY_ITEM()]);
  }

  function removeItem(index: number) {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: unknown) {
    setFormItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        projectId,
        title:   formTitle,
        number:  formNumber.trim() || undefined,
        status:  formStatus,
        dueDate: formDueDate || null,
        notes:   formNotes.trim() || null,
        items:   formItems.filter((i) => i.description.trim()),
      };

      let res: Response;
      if (editInvoice) {
        res = await fetch(`/api/invoices/${editInvoice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        await fetchInvoices();
        setDialogOpen(false);
        toast({
          title: editInvoice ? "Rechnung aktualisiert" : "Rechnung erstellt",
          variant: "success",
        });
      } else {
        const err = await res.json();
        toast({ title: "Fehler", description: err.error, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Rechnung wirklich löschen?")) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchInvoices();
      toast({ title: "Rechnung gelöscht" });
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await fetchInvoices();
      const cfg = STATUS_CONFIG[status];
      toast({ title: `Status: ${cfg?.label || status}`, variant: "success" });
    }
  }

  const totalDraft  = invoices.filter((i) => i.status === "DRAFT").reduce((s, i) => s + calcTotal(i.items), 0);
  const totalSent   = invoices.filter((i) => i.status === "SENT").reduce((s, i)  => s + calcTotal(i.items), 0);
  const totalPaid   = invoices.filter((i) => i.status === "PAID").reduce((s, i)  => s + calcTotal(i.items), 0);

  const formTotal = useMemo(() => calcTotal(formItems), [formItems]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Rechnungen</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{invoices.length} Rechnungen</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => openDialog(null)}>
          <Plus className="h-4 w-4" />
          Neue Rechnung
        </Button>
      </div>

      {/* Summary cards */}
      {invoices.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Entwürfe",   amount: totalDraft, cls: "text-muted-foreground" },
            { label: "Versendet",  amount: totalSent,  cls: "text-blue-600 dark:text-blue-400" },
            { label: "Bezahlt",    amount: totalPaid,  cls: "text-emerald-600 dark:text-emerald-400" },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border bg-card px-4 py-3">
              <div className="text-[11px] font-medium text-muted-foreground">{card.label}</div>
              <div className={cn("text-lg font-bold tabular-nums mt-0.5", card.cls)}>
                {formatCurrency(card.amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Noch keine Rechnungen"
          description="Erstelle die erste Rechnung für dieses Projekt."
          action={
            <button onClick={() => openDialog(null)}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <Plus className="h-4 w-4" />Rechnung erstellen
            </button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          {/* Table header */}
          <div className="flex items-center border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="flex-1 min-w-0">Rechnung</div>
            <div className="w-[100px] shrink-0">Status</div>
            <div className="w-[120px] shrink-0 text-right">Betrag</div>
            <div className="w-[100px] shrink-0 text-center">Fällig</div>
            <div className="w-[50px] shrink-0" />
          </div>

          {invoices.map((invoice) => {
            const total     = calcTotal(invoice.items);
            const overdue   = invoice.status === "SENT" && invoice.dueDate && new Date(invoice.dueDate) < new Date();

            return (
              <div
                key={invoice.id}
                className="group flex items-center border-b px-4 py-3 last:border-b-0 hover:bg-accent/30 transition-colors"
              >
                {/* Invoice info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{invoice.title}</span>
                        {overdue && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                            <AlertCircle className="h-2.5 w-2.5" />Überfällig
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Nr. {invoice.number} · {new Date(invoice.issuedAt).toLocaleDateString("de-DE")}
                        {invoice.items.length > 0 && ` · ${invoice.items.length} Position${invoice.items.length === 1 ? "" : "en"}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="w-[100px] shrink-0">
                  <StatusBadge status={invoice.status} />
                </div>

                {/* Amount */}
                <div className="w-[120px] shrink-0 text-right font-semibold tabular-nums text-sm">
                  {formatCurrency(total)}
                </div>

                {/* Due date */}
                <div className="w-[100px] shrink-0 text-center">
                  {invoice.dueDate ? (
                    <span className={cn("text-xs", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {formatDate(invoice.dueDate)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="w-[50px] shrink-0 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => openDialog(invoice)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {invoice.status === "DRAFT" && (
                        <DropdownMenuItem onClick={() => updateStatus(invoice.id, "SENT")}>
                          <Send className="mr-2 h-3.5 w-3.5 text-blue-500" />Als versendet
                        </DropdownMenuItem>
                      )}
                      {invoice.status === "SENT" && (
                        <DropdownMenuItem onClick={() => updateStatus(invoice.id, "PAID")}>
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" />Als bezahlt
                        </DropdownMenuItem>
                      )}
                      {(invoice.status === "DRAFT" || invoice.status === "SENT") && (
                        <DropdownMenuItem onClick={() => updateStatus(invoice.id, "CANCELLED")}>
                          <X className="mr-2 h-3.5 w-3.5 text-muted-foreground" />Stornieren
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteInvoice(invoice.id)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Invoice Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {editInvoice ? "Rechnung bearbeiten" : "Neue Rechnung"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={saveInvoice} className="space-y-5">
            {/* Basic info */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-title">Titel *</Label>
                <Input
                  id="inv-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="z.B. Webentwicklung Oktober 2024"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-number">Rechnungsnummer</Label>
                <Input
                  id="inv-number"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="Wird automatisch vergeben"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-status">Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger id="inv-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>
                        <span className="flex items-center gap-2">
                          <cfg.icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-due">Fälligkeitsdatum</Label>
                <Input
                  id="inv-due"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Positionen</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addItem}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Position hinzufügen
                </Button>
              </div>

              {/* Items header */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_80px_30px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Beschreibung</span>
                <span className="text-right">Menge</span>
                <span className="text-right">Preis</span>
                <span>Einheit</span>
                <span />
              </div>

              <div className="space-y-2">
                {formItems.map((item, i) => (
                  <div key={i} className="grid sm:grid-cols-[1fr_80px_100px_80px_30px] gap-2 items-center rounded-lg border bg-muted/10 p-2 sm:p-0 sm:rounded-none sm:border-0 sm:bg-transparent">
                    <Input
                      placeholder="Beschreibung..."
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm text-right"
                    />
                    <Select value={item.unit} onValueChange={(v) => updateItem(i, "unit", v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      disabled={formItems.length === 1}
                      className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-end border-t pt-2 mt-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Gesamt:</span>
                  <span className="text-xl font-bold tabular-nums">{formatCurrency(formTotal)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Notizen / Zahlungsbedingungen</Label>
              <Textarea
                id="inv-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="z.B. Zahlbar innerhalb von 14 Tagen..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button type="submit" disabled={submitting || !formTitle.trim()}>
                {submitting && <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {editInvoice ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
