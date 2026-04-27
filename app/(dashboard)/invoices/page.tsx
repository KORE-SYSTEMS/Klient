"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  CheckCircle2,
  X,
  FileText,
  Euro,
  AlertCircle,
  Clock,
  Search,
  FolderKanban,
  ChevronDown,
  Layers,
  Check,
  Import,
  Building2,
  ExternalLink,
  Eye,
  TrendingUp,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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

interface ClientUser {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  role: string;
}

interface ProjectMemberWithUser {
  user: ClientUser;
}

interface InvoiceProject {
  id: string;
  name: string;
  color: string | null;
  members?: ProjectMemberWithUser[];
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  status: string;
  taxRate: number;
  shareToken?: string | null;
  dueDate?: string | null;
  issuedAt: string;
  paidAt?: string | null;
  notes?: string | null;
  projectId: string;
  items: InvoiceItem[];
  project: InvoiceProject;
}

interface Project {
  id: string;
  name: string;
  color: string | null;
  members?: ProjectMemberWithUser[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.FC<{ className?: string }> }> = {
  DRAFT:     { label: "Entwurf",   class: "bg-gray-500/10 text-gray-400",                           icon: FileText },
  SENT:      { label: "Versendet", class: "bg-blue-500/10 text-blue-400",                           icon: Send },
  PAID:      { label: "Bezahlt",   class: "bg-emerald-500/10 text-emerald-400",                     icon: CheckCircle2 },
  OVERDUE:   { label: "Überfällig",class: "bg-red-500/10 text-red-400",                             icon: AlertCircle },
  CANCELLED: { label: "Storniert", class: "bg-gray-500/10 text-gray-500 line-through",              icon: X },
};

const ALL_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];
const UNITS        = ["Std.", "Stk.", "Pauschal", "Tag", "Monat", "%"];
const EMPTY_ITEM   = (): InvoiceItem => ({ description: "", quantity: 1, unitPrice: 0, unit: "Std." });

function calcTotal(items: InvoiceItem[]): number {
  return items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function isOverdue(inv: Invoice): boolean {
  return inv.status === "SENT" && !!inv.dueDate && new Date(inv.dueDate) < new Date();
}

function effectiveStatus(inv: Invoice): string {
  return isOverdue(inv) ? "OVERDUE" : inv.status;
}

function getClient(inv: Invoice): ClientUser | null {
  const clients = inv.project.members?.filter((m) => m.user.role === "CLIENT") ?? [];
  return clients[0]?.user ?? null;
}

function StatusBadge({ status }: { status: string }) {
  const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cfg.class)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function StatCard({
  label, value, icon: Icon, iconClass, accent,
}: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", accent)}>{value}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GlobalInvoicesPage() {
  const { data: session } = useSession();
  const role              = session?.user?.role;
  const isReadOnly        = role === "CLIENT";

  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Filters
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<string>("ALL");

  // Dialog / form
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [editInvoice,  setEditInvoice]  = useState<Invoice | null>(null);
  const [submitting,   setSubmitting]   = useState(false);

  const [formProjectId, setFormProjectId] = useState("");
  const [formTitle,     setFormTitle]     = useState("");
  const [formNumber,    setFormNumber]    = useState("");
  const [formStatus,    setFormStatus]    = useState("DRAFT");
  const [formDueDate,   setFormDueDate]   = useState("");
  const [formNotes,     setFormNotes]     = useState("");
  const [formTaxRate,   setFormTaxRate]   = useState(19);
  const [formItems,     setFormItems]     = useState<InvoiceItem[]>([EMPTY_ITEM()]);
  const [sending,       setSending]       = useState<string | null>(null); // invoiceId being sent

  // Task import
  const [importOpen,    setImportOpen]    = useState(false);
  const [importTasks,   setImportTasks]   = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [importMode,    setImportMode]    = useState<"task" | "epic">("task");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    const res = await fetch("/api/invoices");
    if (res.ok) setInvoices(await res.json());
    setLoading(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : data.projects ?? []);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    if (!isReadOnly) fetchProjects();
  }, [fetchInvoices, fetchProjects, isReadOnly]);

  // ── Task import ────────────────────────────────────────────────────────────

  async function loadImportTasks() {
    if (!formProjectId) return;
    setImportLoading(true);
    const res = await fetch(`/api/tasks?projectId=${formProjectId}`);
    if (res.ok) {
      const all = await res.json();
      setImportTasks(all.filter((t: any) => !t._isPreview && (t.totalTime ?? 0) > 0));
    }
    setImportLoading(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function applyImport() {
    const chosen = importTasks.filter((t) => selectedIds.has(t.id));
    let newItems: InvoiceItem[];
    if (importMode === "epic") {
      const epicMap = new Map<string, { label: string; seconds: number }>();
      for (const t of chosen) {
        const key = t.epic?.id ?? "__none__";
        const ex  = epicMap.get(key);
        epicMap.set(key, { label: t.epic?.title ?? "Ohne Epic", seconds: (ex?.seconds ?? 0) + (t.totalTime ?? 0) });
      }
      newItems = Array.from(epicMap.values()).map(({ label, seconds }) => ({
        description: label,
        quantity: Math.round((seconds / 3600) * 100) / 100,
        unitPrice: 0,
        unit: "Std.",
      }));
    } else {
      newItems = chosen.map((t) => ({
        description: t.title,
        quantity: Math.round(((t.totalTime ?? 0) / 3600) * 100) / 100,
        unitPrice: 0,
        unit: "Std.",
      }));
    }
    setFormItems((prev) => {
      const existing = prev.filter((i) => i.description.trim());
      return [...(existing.length ? existing : []), ...newItems];
    });
    setImportOpen(false);
    setSelectedIds(new Set());
  }

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  function openNew() {
    setEditInvoice(null);
    setFormProjectId(projects[0]?.id ?? "");
    setFormTitle("");
    setFormNumber("");
    setFormStatus("DRAFT");
    setFormDueDate("");
    setFormNotes("");
    setFormTaxRate(19);
    setFormItems([EMPTY_ITEM()]);
    setDialogOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditInvoice(inv);
    setFormProjectId(inv.projectId);
    setFormTitle(inv.title);
    setFormNumber(inv.number);
    setFormStatus(inv.status);
    setFormDueDate(inv.dueDate ? inv.dueDate.split("T")[0] : "");
    setFormNotes(inv.notes ?? "");
    setFormTaxRate(inv.taxRate ?? 19);
    setFormItems(inv.items.length ? inv.items : [EMPTY_ITEM()]);
    setDialogOpen(true);
  }

  function addItem()                { setFormItems((p) => [...p, EMPTY_ITEM()]); }
  function removeItem(i: number)    { setFormItems((p) => p.filter((_, j) => j !== i)); }
  function updateItem(i: number, k: keyof InvoiceItem, v: unknown) {
    setFormItems((p) => p.map((item, j) => j === i ? { ...item, [k]: v } : item));
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formProjectId) return;
    setSubmitting(true);
    try {
      const body = {
        projectId: formProjectId,
        title:     formTitle,
        number:    formNumber.trim() || undefined,
        status:    formStatus,
        taxRate:   formTaxRate,
        dueDate:   formDueDate || null,
        notes:     formNotes.trim() || null,
        items:     formItems.filter((i) => i.description.trim()),
      };

      let res: Response;
      if (editInvoice) {
        res = await fetch(`/api/invoices/${editInvoice.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/invoices", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error();
      const saved = await res.json();

      setInvoices((prev) =>
        editInvoice
          ? prev.map((i) => i.id === saved.id ? saved : i)
          : [saved, ...prev]
      );
      setDialogOpen(false);
      toast({ title: editInvoice ? "Rechnung aktualisiert" : "Rechnung erstellt" });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Send invoice ───────────────────────────────────────────────────────────

  async function sendInvoice(inv: Invoice) {
    setSending(inv.id);
    const res = await fetch(`/api/invoices/${inv.id}/send`, { method: "POST" });
    setSending(null);
    if (res.ok) {
      const updated = await res.json();
      // Merge only the changed fields so we don't lose the project.members client data
      setInvoices((prev) => prev.map((i) => i.id === inv.id
        ? { ...i, status: updated.status, shareToken: updated.shareToken }
        : i
      ));
      toast({ title: "Rechnung versendet ✓" });
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Versand fehlgeschlagen", description: data.error || "SMTP nicht konfiguriert?", variant: "destructive" });
    }
  }

  // ── Copy share link ────────────────────────────────────────────────────────

  async function copyShareLink(inv: Invoice) {
    let token = inv.shareToken;
    if (!token) {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateShareToken: true }),
      });
      if (res.ok) { const u = await res.json(); token = u.shareToken; setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, shareToken: u.shareToken } : i)); }
    }
    if (token) {
      await navigator.clipboard.writeText(`${window.location.origin}/i/${token}`);
      toast({ title: "Link kopiert ✓" });
    }
  }

  // ── Status change ──────────────────────────────────────────────────────────

  async function changeStatus(inv: Invoice, status: string) {
    const res = await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInvoices((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      toast({ title: `Status auf „${STATUS_CONFIG[status]?.label}" geändert` });
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteInvoice(id: string) {
    if (!confirm("Rechnung wirklich löschen?")) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) {
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Rechnung gelöscht" });
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const eff    = effectiveStatus(inv);
      const client = getClient(inv);
      const q      = search.toLowerCase();

      if (statusFilter !== "ALL" && eff !== statusFilter) return false;
      if (q && ![
        inv.number, inv.title, inv.project.name,
        client?.name ?? "", client?.email ?? "", client?.company ?? "",
      ].some((s) => s.toLowerCase().includes(q))) return false;

      return true;
    });
  }, [invoices, search, statusFilter]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let totalBilled = 0, outstanding = 0, overdueTotal = 0, paidThisMonth = 0;

    for (const inv of invoices) {
      const total = calcTotal(inv.items);
      if (inv.status !== "CANCELLED" && inv.status !== "DRAFT") totalBilled += total;
      if (isOverdue(inv)) overdueTotal += total;
      else if (inv.status === "SENT") outstanding += total;
      if (inv.status === "PAID" && inv.paidAt && new Date(inv.paidAt) >= startOfMonth) paidThisMonth += total;
    }

    return { totalBilled, outstanding, overdueTotal, paidThisMonth };
  }, [invoices]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Rechnungen</h1>
          <p className="text-sm text-muted-foreground">Alle Rechnungen im Überblick</p>
        </div>
        {!isReadOnly && (
          <Button size="sm" className="gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Neue Rechnung
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gesamt fakturiert"   value={formatCurrency(stats.totalBilled)}  icon={Euro}         iconClass="text-muted-foreground" />
        <StatCard label="Offen"               value={formatCurrency(stats.outstanding)}   icon={Clock}        iconClass={stats.outstanding > 0 ? "text-blue-400" : "text-muted-foreground"}    accent={stats.outstanding > 0 ? "text-blue-400" : undefined} />
        <StatCard label="Überfällig"          value={formatCurrency(stats.overdueTotal)}  icon={AlertCircle}  iconClass={stats.overdueTotal > 0 ? "text-red-400" : "text-muted-foreground"}    accent={stats.overdueTotal > 0 ? "text-red-400" : undefined} />
        <StatCard label="Eingegangen (Monat)" value={formatCurrency(stats.paidThisMonth)} icon={TrendingUp}   iconClass="text-emerald-400" accent="text-emerald-400" />
      </div>

      {/* Filter + List */}
      <div className="rounded-lg border overflow-hidden">
        {/* Filter bar */}
        <div className="border-b px-4 py-3 flex items-center gap-3 flex-wrap bg-card">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="Alle Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Status</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} Rechnung{filtered.length !== 1 ? "en" : ""}
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center bg-card">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== "ALL"
                ? "Keine Rechnungen für diese Filter"
                : isReadOnly
                ? "Noch keine Rechnungen vorhanden"
                : "Erstelle deine erste Rechnung"}
            </p>
            {!isReadOnly && !search && statusFilter === "ALL" && (
              <Button size="sm" onClick={openNew} variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Neue Rechnung
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Rechnung</span>
              <span>Kunde</span>
              <span>Projekt</span>
              <span>Betrag</span>
              <span>Status</span>
              <span className="w-8" />
            </div>

            {/* Rows */}
            {filtered.map((inv) => {
              const client = getClient(inv);
              const eff    = effectiveStatus(inv);
              const total  = calcTotal(inv.items);
              const over   = eff === "OVERDUE";

              return (
                <div
                  key={inv.id}
                  className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4 items-center border-b px-4 py-3 last:border-0 hover:bg-accent/30 transition-colors"
                >
                  {/* Number + title */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">#{inv.number}</span>
                      <span className="text-sm font-medium truncate">{inv.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(inv.issuedAt)}
                      </span>
                      {inv.dueDate && (
                        <span className={cn(
                          "text-[11px]",
                          over ? "text-red-400 font-medium" : "text-muted-foreground"
                        )}>
                          · fällig {formatDate(inv.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Client */}
                  <div className="min-w-0">
                    {client ? (
                      <>
                        <p className="text-sm font-medium truncate">{client.name || client.email}</p>
                        {client.company && (
                          <p className="text-[11px] text-muted-foreground truncate">{client.company}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Project */}
                  <div className="flex items-center min-w-0">
                    <span className="text-sm truncate">{inv.project.name}</span>
                  </div>

                  {/* Amount — show brutto if taxRate > 0 */}
                  <div className="tabular-nums">
                    <span className="text-sm font-semibold">
                      {formatCurrency(total * (1 + (inv.taxRate ?? 0) / 100))}
                    </span>
                    {(inv.taxRate ?? 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground">inkl. {inv.taxRate}% MwSt.</p>
                    )}
                  </div>

                  {/* Status */}
                  <StatusBadge status={eff} />

                  {/* Actions */}
                  {isReadOnly ? (
                    <div className="w-8" />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEdit(inv)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => sendInvoice(inv)}
                          disabled={sending === inv.id}
                        >
                          <Send className="h-3.5 w-3.5 mr-2" />
                          {sending === inv.id ? "Wird gesendet…" : "Per E-Mail senden"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyShareLink(inv)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Link kopieren
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/i/${inv.shareToken || ""}`, "_blank")} disabled={!inv.shareToken}>
                          <Eye className="h-3.5 w-3.5 mr-2" /> Öffentliche Ansicht
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Status ändern
                        </p>
                        {(["DRAFT","SENT","PAID","CANCELLED"] as const).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            disabled={inv.status === s}
                            onClick={() => changeStatus(inv, s)}
                          >
                            {inv.status === s && <Check className="h-3.5 w-3.5 mr-2 text-primary" />}
                            {inv.status !== s && <span className="w-3.5 mr-2" />}
                            {STATUS_CONFIG[s]?.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteInvoice(inv.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editInvoice ? "Rechnung bearbeiten" : "Neue Rechnung"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={saveInvoice} className="space-y-5 pt-1">
            {/* Project selector (only when creating) */}
            {!editInvoice && (
              <div className="space-y-1.5">
                <Label>Projekt *</Label>
                <Select value={formProjectId} onValueChange={setFormProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Projekt wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Title + Number row */}
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="z. B. Webseite Relaunch – Phase 1"
                  required
                />
              </div>
              <div className="space-y-1.5 w-36">
                <Label htmlFor="number">Nummer</Label>
                <Input
                  id="number"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="auto"
                />
              </div>
            </div>

            {/* Status + MwSt. + Due date row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["DRAFT","SENT","PAID","CANCELLED"].map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>MwSt.</Label>
                <Select value={String(formTaxRate)} onValueChange={(v) => setFormTaxRate(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (steuerfrei)</SelectItem>
                    <SelectItem value="7">7%</SelectItem>
                    <SelectItem value="19">19%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fälligkeitsdatum</Label>
                <DatePicker value={formDueDate} onChange={setFormDueDate} placeholder="Kein Datum" />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Positionen</Label>
                {formProjectId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { loadImportTasks(); setImportOpen(true); }}
                  >
                    <Import className="h-3.5 w-3.5" />
                    Aus Aufgaben importieren
                  </Button>
                )}
              </div>

              {/* Import panel */}
              {importOpen && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant={importMode === "task" ? "default" : "outline"} className="h-7 gap-1.5 text-xs" onClick={() => setImportMode("task")}>
                        <FolderKanban className="h-3.5 w-3.5" /> Aufgaben
                      </Button>
                      <Button type="button" size="sm" variant={importMode === "epic" ? "default" : "outline"} className="h-7 gap-1.5 text-xs" onClick={() => setImportMode("epic")}>
                        <Layers className="h-3.5 w-3.5" /> Epics
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImportOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {importLoading ? (
                    <p className="text-xs text-muted-foreground">Lade Aufgaben…</p>
                  ) : importTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine Aufgaben mit erfasster Zeit gefunden.</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {importTasks.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent/50">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                            className="rounded"
                          />
                          <span className="flex-1 text-xs truncate">{t.title}</span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {Math.round(((t.totalTime ?? 0) / 3600) * 100) / 100} Std.
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    disabled={selectedIds.size === 0}
                    onClick={applyImport}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {selectedIds.size} Positionen übernehmen
                  </Button>
                </div>
              )}

              {/* Item rows */}
              <div className="space-y-2">
                {formItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_110px_90px_auto] gap-2 items-end">
                    <div>
                      {i === 0 && <Label className="text-[11px] text-muted-foreground mb-1 block">Beschreibung</Label>}
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(i, "description", e.target.value)}
                        placeholder="Position"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-[11px] text-muted-foreground mb-1 block">Menge</Label>}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-[11px] text-muted-foreground mb-1 block">Einzel­preis</Label>}
                      <div className="relative">
                        <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="h-8 pl-6 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      {i === 0 && <Label className="text-[11px] text-muted-foreground mb-1 block">Einheit</Label>}
                      <Select value={item.unit} onValueChange={(v) => updateItem(i, "unit", v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeItem(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button type="button" variant="ghost" size="sm" onClick={addItem} className="h-7 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Position hinzufügen
              </Button>

              {/* Total */}
              {formItems.some((i) => i.description.trim()) && (() => {
                const netto  = calcTotal(formItems.filter((i) => i.description.trim()));
                const mwst   = netto * formTaxRate / 100;
                const brutto = netto + mwst;
                return (
                  <div className="flex justify-end rounded-lg bg-muted/40 px-4 py-3">
                    <div className="text-right space-y-1 min-w-[180px]">
                      <div className="flex items-center justify-between gap-8 text-sm text-muted-foreground">
                        <span>Netto</span>
                        <span className="tabular-nums">{formatCurrency(netto)}</span>
                      </div>
                      {formTaxRate > 0 && (
                        <div className="flex items-center justify-between gap-8 text-sm text-muted-foreground">
                          <span>MwSt. {formTaxRate}%</span>
                          <span className="tabular-nums">{formatCurrency(mwst)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-8 border-t pt-1">
                        <span className="text-sm font-semibold">Gesamt</span>
                        <span className="text-lg font-bold tabular-nums">{formatCurrency(brutto)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Anmerkungen</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Zahlungsbedingungen, Hinweise…"
                className="resize-none text-sm"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button type="submit" disabled={submitting || !formTitle.trim() || !formProjectId}>
                {submitting ? "Speichern…" : editInvoice ? "Speichern" : "Rechnung erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
