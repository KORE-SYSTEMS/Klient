"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  FileText,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  CheckCircle2,
  X,
  AlertCircle,
  Euro,
  Search,
  FolderKanban,
  Layers,
  Check,
  Import,
  ArrowRightLeft,
  ExternalLink,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProposalItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  order?: number;
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

interface ProposalProject {
  id: string;
  name: string;
  color: string | null;
  members?: ProjectMemberWithUser[];
}

interface Proposal {
  id: string;
  number: string;
  title: string;
  status: string;
  taxRate: number;
  validUntil: string | null;
  issuedAt: string;
  notes: string | null;
  shareToken: string | null;
  projectId: string | null;
  clientId: string | null;
  items: ProposalItem[];
  project: ProposalProject | null;
  client: ClientUser | null;
}

interface Project {
  id: string;
  name: string;
  color: string | null;
  members?: ProjectMemberWithUser[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.FC<{ className?: string }> }> = {
  DRAFT:    { label: "Entwurf",    class: "bg-gray-500/10 text-gray-400",         icon: FileText },
  SENT:     { label: "Versendet",  class: "bg-blue-500/10 text-blue-400",          icon: Send },
  ACCEPTED: { label: "Akzeptiert", class: "bg-emerald-500/10 text-emerald-400",    icon: CheckCircle2 },
  DECLINED: { label: "Abgelehnt",  class: "bg-red-500/10 text-red-400",            icon: X },
  EXPIRED:  { label: "Abgelaufen", class: "bg-orange-500/10 text-orange-400",      icon: AlertCircle },
};

const ALL_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"];
const UNITS        = ["Std.", "Stk.", "Pauschal", "Tag", "Monat", "%"];
const EMPTY_ITEM   = (): ProposalItem => ({ description: "", quantity: 1, unitPrice: 0, unit: "Std." });

const TAX_RATES = [0, 7, 19];

function calcNetto(items: ProposalItem[]): number {
  return items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
}

function calcBrutto(items: ProposalItem[], taxRate: number): number {
  const netto = calcNetto(items);
  return netto + netto * taxRate / 100;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function isExpired(p: Proposal): boolean {
  return p.status === "SENT" && !!p.validUntil && new Date(p.validUntil) < new Date();
}

function effectiveStatus(p: Proposal): string {
  return isExpired(p) ? "EXPIRED" : p.status;
}

function getProposalClient(p: Proposal): ClientUser | null {
  if (p.client) return p.client;
  const clients = p.project?.members?.filter((m) => m.user.role === "CLIENT") ?? [];
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

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", accent)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const { data: session } = useSession();
  const router            = useRouter();
  const role              = session?.user?.role;

  const [proposals,  setProposals]  = useState<Proposal[]>([]);
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [clients,    setClients]    = useState<ClientUser[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Dialog / form
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editProposal,  setEditProposal]  = useState<Proposal | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [sending,       setSending]       = useState<string | null>(null);
  const [converting,    setConverting]    = useState<string | null>(null);

  const [formProjectId, setFormProjectId] = useState("");
  const [formClientId,  setFormClientId]  = useState("");
  const [formTitle,     setFormTitle]     = useState("");
  const [formNumber,    setFormNumber]    = useState("");
  const [formStatus,    setFormStatus]    = useState("DRAFT");
  const [formValidUntil,setFormValidUntil]= useState("");
  const [formTaxRate,   setFormTaxRate]   = useState("19");
  const [formNotes,     setFormNotes]     = useState("");
  const [formItems,     setFormItems]     = useState<ProposalItem[]>([EMPTY_ITEM()]);

  // Task import
  const [importOpen,    setImportOpen]    = useState(false);
  const [importTasks,   setImportTasks]   = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [importMode,    setImportMode]    = useState<"task" | "epic">("task");

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProposals = useCallback(async () => {
    const res = await fetch("/api/proposals");
    if (res.ok) setProposals(await res.json());
    setLoading(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : data.projects ?? []);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data: ClientUser[] = await res.json();
      setClients(data.filter((u) => u.role === "CLIENT"));
    }
  }, []);

  useEffect(() => {
    fetchProposals();
    fetchProjects();
    fetchClients();
  }, [fetchProposals, fetchProjects, fetchClients]);

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
    let newItems: ProposalItem[];
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
    setEditProposal(null);
    setFormProjectId(projects[0]?.id ?? "");
    setFormClientId("");
    setFormTitle("");
    setFormNumber("");
    setFormStatus("DRAFT");
    setFormValidUntil("");
    setFormTaxRate("19");
    setFormNotes("");
    setFormItems([EMPTY_ITEM()]);
    setDialogOpen(true);
  }

  function openEdit(p: Proposal) {
    setEditProposal(p);
    setFormProjectId(p.projectId ?? "");
    setFormClientId(p.clientId ?? "");
    setFormTitle(p.title);
    setFormNumber(p.number);
    setFormStatus(p.status);
    setFormValidUntil(p.validUntil ? p.validUntil.split("T")[0] : "");
    setFormTaxRate(String(p.taxRate));
    setFormNotes(p.notes ?? "");
    setFormItems(p.items.length ? p.items : [EMPTY_ITEM()]);
    setDialogOpen(true);
  }

  function addItem()             { setFormItems((p) => [...p, EMPTY_ITEM()]); }
  function removeItem(i: number) { setFormItems((p) => p.filter((_, j) => j !== i)); }
  function updateItem(i: number, k: keyof ProposalItem, v: unknown) {
    setFormItems((p) => p.map((item, j) => j === i ? { ...item, [k]: v } : item));
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function saveProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        projectId:  formProjectId || null,
        clientId:   formClientId  || null,
        title:      formTitle,
        number:     formNumber.trim() || undefined,
        status:     formStatus,
        validUntil: formValidUntil || null,
        taxRate:    parseInt(formTaxRate, 10),
        notes:      formNotes.trim() || null,
        items:      formItems.filter((i) => i.description.trim()),
      };

      let res: Response;
      if (editProposal) {
        res = await fetch(`/api/proposals/${editProposal.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/proposals", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error();
      const saved = await res.json();

      setProposals((prev) =>
        editProposal
          ? prev.map((p) => p.id === saved.id ? saved : p)
          : [saved, ...prev]
      );
      setDialogOpen(false);
      toast({ title: editProposal ? "Angebot aktualisiert" : "Angebot erstellt" });
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  async function sendProposal(p: Proposal) {
    setSending(p.id);
    try {
      const res = await fetch(`/api/proposals/${p.id}/send`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Fehler beim Versenden", variant: "destructive" });
        return;
      }
      const updated = await res.json();
      setProposals((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      toast({ title: "Angebot versendet" });
    } catch {
      toast({ title: "Fehler beim Versenden", variant: "destructive" });
    } finally {
      setSending(null);
    }
  }

  // ── Convert to invoice ─────────────────────────────────────────────────────

  async function convertToInvoice(p: Proposal) {
    if (!p.projectId) {
      toast({ title: "Kein Projekt zugeordnet – Konvertierung nicht möglich", variant: "destructive" });
      return;
    }
    if (!confirm(`Angebot "${p.title}" in eine Rechnung konvertieren?`)) return;
    setConverting(p.id);
    try {
      const res = await fetch(`/api/proposals/${p.id}/convert`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Fehler beim Konvertieren", variant: "destructive" });
        return;
      }
      const invoice = await res.json();
      // Mark proposal as ACCEPTED in local state
      setProposals((prev) =>
        prev.map((x) => x.id === p.id ? { ...x, status: "ACCEPTED" } : x)
      );
      toast({ title: "Rechnung erstellt" });
      router.push("/invoices");
    } catch {
      toast({ title: "Fehler beim Konvertieren", variant: "destructive" });
    } finally {
      setConverting(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteProposal(id: string) {
    if (!confirm("Angebot wirklich löschen?")) return;
    const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProposals((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Angebot gelöscht" });
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      const eff    = effectiveStatus(p);
      const client = getProposalClient(p);
      const q      = search.toLowerCase();

      if (statusFilter !== "ALL" && eff !== statusFilter) return false;
      if (q && ![
        p.number, p.title, p.project?.name ?? "",
        client?.name ?? "", client?.email ?? "", client?.company ?? "",
      ].some((s) => s.toLowerCase().includes(q))) return false;

      return true;
    });
  }, [proposals, search, statusFilter]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let totalSent = 0, accepted = 0, declined = 0;

    for (const p of proposals) {
      const eff = effectiveStatus(p);
      if (eff !== "DRAFT") totalSent++;
      if (eff === "ACCEPTED") accepted++;
      if (eff === "DECLINED" || eff === "EXPIRED") declined++;
    }

    const acceptanceRate = totalSent > 0 ? Math.round((accepted / totalSent) * 100) : 0;

    return { totalSent, accepted, declined, acceptanceRate };
  }, [proposals]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const validTaxRates = Array.from(new Set([...TAX_RATES, parseInt(formTaxRate, 10)])).sort((a, b) => a - b);
  const nettoPreview  = calcNetto(formItems.filter((i) => i.description.trim()));
  const taxPreview    = nettoPreview * parseInt(formTaxRate, 10) / 100;
  const bruttoPreview = nettoPreview + taxPreview;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Angebote</h1>
            <p className="text-sm text-muted-foreground">Alle Angebote im Überblick</p>
          </div>
          <Button size="sm" className="gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Neues Angebot
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Versendet"       value={String(stats.totalSent)}    />
          <StatCard label="Akzeptiert"      value={String(stats.accepted)}     accent={stats.accepted > 0 ? "text-emerald-400" : undefined} />
          <StatCard label="Abgelehnt / Abgelaufen" value={String(stats.declined)} accent={stats.declined > 0 ? "text-red-400" : undefined} />
          <StatCard label="Annahmequote"    value={`${stats.acceptanceRate} %`} accent={stats.acceptanceRate >= 50 ? "text-emerald-400" : "text-muted-foreground"} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b px-6 py-3 flex items-center gap-3 flex-wrap bg-card/50">
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
          <SelectTrigger className="h-8 w-[170px] text-sm">
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
          {filtered.length} Angebot{filtered.length !== 1 ? "e" : ""}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== "ALL"
                ? "Keine Angebote für diese Filter"
                : "Erstelle dein erstes Angebot"}
            </p>
            {!search && statusFilter === "ALL" && (
              <Button size="sm" onClick={openNew} variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Neues Angebot
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_1fr_auto] gap-4 border-b bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Angebot</span>
              <span>Kunde</span>
              <span>Projekt</span>
              <span>Betrag</span>
              <span>Status</span>
              <span>Gültig bis</span>
              <span className="w-8" />
            </div>

            {/* Rows */}
            {filtered.map((p) => {
              const client = getProposalClient(p);
              const eff    = effectiveStatus(p);
              const brutto = calcBrutto(p.items, p.taxRate);
              const expired = eff === "EXPIRED";

              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_1fr_auto] gap-4 items-center border-b px-4 py-3 last:border-0 hover:bg-accent/30 transition-colors"
                >
                  {/* Number + title */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">#{p.number}</span>
                      <span className="text-sm font-medium truncate">{p.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(p.issuedAt)}
                      </span>
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
                    <span className="text-sm truncate">{p.project?.name ?? "—"}</span>
                  </div>

                  {/* Amount (brutto) */}
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(brutto)}
                  </span>

                  {/* Status */}
                  <StatusBadge status={eff} />

                  {/* Valid until */}
                  <span className={cn(
                    "text-sm",
                    expired ? "text-orange-400 font-medium" : "text-muted-foreground"
                  )}>
                    {p.validUntil ? formatDate(p.validUntil) : "—"}
                  </span>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        disabled={sending === p.id || converting === p.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Bearbeiten
                      </DropdownMenuItem>
                      {p.shareToken && (
                        <DropdownMenuItem onClick={() => window.open(`/p/${p.shareToken}`, "_blank")}>
                          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Angebot öffnen
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => sendProposal(p)}
                        disabled={sending === p.id}
                      >
                        <Send className="h-3.5 w-3.5 mr-2" />
                        {sending === p.id ? "Wird versendet…" : "Versenden"}
                      </DropdownMenuItem>
                      {p.projectId && (
                        <DropdownMenuItem
                          onClick={() => convertToInvoice(p)}
                          disabled={converting === p.id}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                          {converting === p.id ? "Konvertiert…" : "Zu Rechnung konvertieren"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Status ändern
                      </p>
                      {(["DRAFT","SENT","ACCEPTED","DECLINED","EXPIRED"] as const).map((s) => (
                        <DropdownMenuItem
                          key={s}
                          disabled={p.status === s}
                          onClick={async () => {
                            const res = await fetch(`/api/proposals/${p.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: s }),
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              setProposals((prev) => prev.map((x) => x.id === updated.id ? updated : x));
                              toast({ title: `Status auf „${STATUS_CONFIG[s]?.label}" geändert` });
                            }
                          }}
                        >
                          {p.status === s && <Check className="h-3.5 w-3.5 mr-2 text-primary" />}
                          {p.status !== s && <span className="w-3.5 mr-2" />}
                          {STATUS_CONFIG[s]?.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteProposal(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            <DialogTitle>{editProposal ? "Angebot bearbeiten" : "Neues Angebot"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={saveProposal} className="space-y-5 pt-1">
            {/* Project selector */}
            <div className="space-y-1.5">
              <Label>Projekt</Label>
              <Select value={formProjectId} onValueChange={setFormProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kein Projekt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Projekt</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client selector */}
            <div className="space-y-1.5">
              <Label>Kunde</Label>
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Keinen Kunden zuordnen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keinen Kunden zuordnen</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name ?? c.email}{c.company ? ` (${c.company})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <div className="space-y-1.5 w-44">
                <Label htmlFor="number">Nummer</Label>
                <Input
                  id="number"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="auto"
                />
              </div>
            </div>

            {/* Status + ValidUntil + TaxRate */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Gültig bis</Label>
                <DatePicker value={formValidUntil} onChange={setFormValidUntil} placeholder="Kein Datum" />
              </div>
              <div className="space-y-1.5">
                <Label>MwSt.</Label>
                <Select value={formTaxRate} onValueChange={setFormTaxRate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validTaxRates.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r} %</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      {i === 0 && <Label className="text-[11px] text-muted-foreground mb-1 block">Einzelpreis</Label>}
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

              {/* Totals preview */}
              {formItems.some((i) => i.description.trim()) && (
                <div className="rounded-lg bg-muted/40 px-4 py-3">
                  <div className="flex justify-end gap-8 text-sm">
                    <div className="text-right space-y-1">
                      <div className="flex gap-6 justify-between">
                        <span className="text-muted-foreground text-xs">Netto</span>
                        <span className="font-medium tabular-nums">{formatCurrency(nettoPreview)}</span>
                      </div>
                      <div className="flex gap-6 justify-between">
                        <span className="text-muted-foreground text-xs">MwSt. {formTaxRate} %</span>
                        <span className="font-medium tabular-nums">{formatCurrency(taxPreview)}</span>
                      </div>
                      <div className="flex gap-6 justify-between border-t pt-1 mt-1">
                        <span className="text-xs font-semibold">Brutto</span>
                        <span className="text-base font-bold tabular-nums">{formatCurrency(bruttoPreview)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
              <Button type="submit" disabled={submitting || !formTitle.trim()}>
                {submitting ? "Speichern…" : editProposal ? "Speichern" : "Angebot erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
