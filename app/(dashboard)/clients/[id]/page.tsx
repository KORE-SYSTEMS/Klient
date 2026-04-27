"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getInitials, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  FolderKanban,
  CalendarClock,
  StickyNote,
  Receipt,
  Plus,
  Trash2,
  Pin,
  PinOff,
  Users,
  Handshake,
  Presentation,
  MessageSquare,
  Edit2,
  Check,
  X,
  TrendingUp,
  Clock,
  Euro,
  CheckCircle2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ClientNote {
  id: string;
  title: string | null;
  content: string;
  pinned: boolean;
  authorId: string;
  createdAt: string;
}

interface ClientActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  date: string;
  duration: number | null;
  outcome: string | null;
  authorId: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  description: string | null;
  dueDate: string | null;
  color: string | null;
  createdAt: string;
  invoices: { id: string; status: string; items: { quantity: number; unitPrice: number }[] }[];
}

interface Client {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  image: string | null;
  active: boolean;
  phone: string | null;
  website: string | null;
  address: string | null;
  leadStatus: string | null;
  leadValue: number | null;
  leadSource: string | null;
  tags: string | null;
  createdAt: string;
  projects: { project: Project }[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  { value: "CALL",     label: "Anruf",     icon: Phone },
  { value: "EMAIL",    label: "E-Mail",    icon: Mail },
  { value: "MEETING",  label: "Meeting",   icon: Users },
  { value: "DEMO",     label: "Demo",      icon: Presentation },
  { value: "PROPOSAL", label: "Angebot",   icon: Handshake },
  { value: "OTHER",    label: "Sonstiges", icon: MessageSquare },
];

const OUTCOME_OPTIONS = [
  { value: "POSITIVE", label: "Positiv",  color: "text-emerald-500" },
  { value: "NEUTRAL",  label: "Neutral",  color: "text-muted-foreground" },
  { value: "NEGATIVE", label: "Negativ",  color: "text-red-500" },
];

const LEAD_STATUSES = [
  { value: "LEAD",      label: "Lead",       color: "bg-slate-500/15 text-slate-400" },
  { value: "PROSPECT",  label: "Prospect",   color: "bg-blue-500/15 text-blue-400" },
  { value: "QUALIFIED", label: "Qualifiziert", color: "bg-violet-500/15 text-violet-400" },
  { value: "PROPOSAL",  label: "Angebot",    color: "bg-amber-500/15 text-amber-400" },
  { value: "WON",       label: "Gewonnen",   color: "bg-emerald-500/15 text-emerald-500" },
  { value: "LOST",      label: "Verloren",   color: "bg-red-500/15 text-red-400" },
];

const PROJECT_STATUS_COLORS: Record<string, string> = {
  PLANNING:    "bg-slate-500/15 text-slate-400",
  ACTIVE:      "bg-blue-500/15 text-blue-400",
  IN_PROGRESS: "bg-violet-500/15 text-violet-400",
  REVIEW:      "bg-amber-500/15 text-amber-400",
  DONE:        "bg-emerald-500/15 text-emerald-500",
  ON_HOLD:     "bg-orange-500/15 text-orange-400",
  CANCELLED:   "bg-red-500/15 text-red-400",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function activityIcon(type: string) {
  const found = ACTIVITY_TYPES.find((t) => t.value === type);
  return found?.icon ?? MessageSquare;
}

function activityLabel(type: string) {
  return ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type;
}

function outcomeColor(outcome: string | null) {
  return OUTCOME_OPTIONS.find((o) => o.value === outcome)?.color ?? "";
}

function formatInvoiceTotal(items: { quantity: number; unitPrice: number }[]) {
  return items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
}

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

// ── Tab component ──────────────────────────────────────────────────────────

type Tab = "overview" | "projects" | "activities" | "notes" | "invoices";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 border-b-2 pb-3 pt-1 text-[13px] font-medium transition-colors whitespace-nowrap",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ── Editable field ─────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  icon: Icon,
  onSave,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | null;
  icon?: React.ElementType;
  onSave: (val: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function commit() {
    onSave(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</Label>
        <div className="flex gap-1.5">
          <Input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={commit}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={cancel}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    );
  }

  return (
    <button
      className="group w-full text-left space-y-1"
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
    >
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 min-h-[2rem]">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className={cn("text-sm", value ? "text-foreground" : "text-muted-foreground/50 italic")}>
          {value || placeholder || "—"}
        </span>
        <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  // Note form
  const [noteContent, setNoteContent] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Activity form
  const [actOpen, setActOpen] = useState(false);
  const [actForm, setActForm] = useState({ type: "CALL", title: "", description: "", date: new Date().toISOString().slice(0, 16), duration: "", outcome: "__none__" });
  const [savingAct, setSavingAct] = useState(false);

  const load = useCallback(async () => {
    const [clientRes, notesRes, activitiesRes] = await Promise.all([
      fetch(`/api/clients/${id}`),
      fetch(`/api/clients/${id}/notes`),
      fetch(`/api/clients/${id}/activities`),
    ]);
    if (!clientRes.ok) { router.push("/clients"); return; }
    const [c, n, a] = await Promise.all([clientRes.json(), notesRes.json(), activitiesRes.json()]);
    setClient(c);
    setNotes(Array.isArray(n) ? n : []);
    setActivities(Array.isArray(a) ? a : []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function patchClient(data: Record<string, unknown>) {
    await fetch(`/api/clients/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setClient((c) => c ? { ...c, ...data } as Client : c);
  }

  async function saveNote() {
    if (!noteContent.trim()) return;
    setSavingNote(true);
    const res = await fetch(`/api/clients/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: noteTitle, content: noteContent }),
    });
    const n = await res.json();
    setNotes((prev) => [n, ...prev]);
    setNoteContent("");
    setNoteTitle("");
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    await fetch(`/api/clients/${id}/notes/${noteId}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  async function togglePin(note: ClientNote) {
    await fetch(`/api/clients/${id}/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, pinned: !n.pinned } : n)
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
  }

  async function saveActivity() {
    if (!actForm.title.trim()) return;
    setSavingAct(true);
    const res = await fetch(`/api/clients/${id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...actForm, duration: actForm.duration ? Number(actForm.duration) : null, outcome: actForm.outcome === "__none__" ? null : actForm.outcome || null }),
    });
    const a = await res.json();
    setActivities((prev) => [a, ...prev]);
    setActForm({ type: "CALL", title: "", description: "", date: new Date().toISOString().slice(0, 16), duration: "", outcome: "__none__" });
    setActOpen(false);
    setSavingAct(false);
  }

  async function deleteActivity(actId: string) {
    await fetch(`/api/clients/${id}/activities/${actId}`, { method: "DELETE" });
    setActivities((prev) => prev.filter((a) => a.id !== actId));
  }

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
  if (!client) return null;

  const tags: string[] = client.tags ? JSON.parse(client.tags) : [];
  const leadInfo = LEAD_STATUSES.find((l) => l.value === client.leadStatus);

  // Aggregated stats
  const totalProjects = client.projects.length;
  const totalInvoiceValue = client.projects.flatMap((p) => p.project.invoices)
    .flatMap((inv) => inv.items)
    .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const allInvoices = client.projects.flatMap((p) =>
    p.project.invoices.map((inv) => ({ ...inv, projectName: p.project.name }))
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Kunden
      </Link>

      {/* Header card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
              <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                {getInitials(client.name || client.email)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h1 className="font-heading text-xl font-bold tracking-tight leading-none">
                {client.name || "Kein Name"}
              </h1>
              {client.company && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {client.company}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {client.email.startsWith("placeholder-") ? "Keine E-Mail" : client.email}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {leadInfo && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", leadInfo.color)}>
                <TrendingUp className="h-3 w-3" />
                {leadInfo.label}
              </span>
            )}
            {!client.active && <Badge variant="destructive">Deaktiviert</Badge>}
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-5">
          {[
            { icon: FolderKanban, label: "Projekte",  value: totalProjects },
            { icon: CalendarClock, label: "Aktivitäten", value: activities.length },
            { icon: StickyNote,   label: "Notizen",   value: notes.length },
            { icon: Euro,         label: "Umsatz",    value: formatEur(totalInvoiceValue) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-0.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
              </div>
              <div className="text-lg font-bold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-6 overflow-x-auto">
        {(["overview", "projects", "activities", "notes", "invoices"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            overview: "Übersicht", projects: "Projekte",
            activities: "Aktivitäten", notes: "Notizen", invoices: "Rechnungen",
          };
          const icons: Record<Tab, React.ElementType> = {
            overview: Building2, projects: FolderKanban,
            activities: CalendarClock, notes: StickyNote, invoices: Receipt,
          };
          const Icon = icons[t];
          return (
            <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
              <Icon className="h-3.5 w-3.5" />{labels[t]}
            </TabButton>
          );
        })}
      </div>

      {/* ── Tab: Übersicht ── */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Contact info */}
          <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kontaktdaten</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableField label="Name" value={client.name} onSave={(v) => patchClient({ name: v })} placeholder="Name eingeben" />
              <EditableField label="Firma" value={client.company} icon={Building2} onSave={(v) => patchClient({ company: v })} placeholder="Firma eingeben" />
              <EditableField label="Telefon" value={client.phone} icon={Phone} onSave={(v) => patchClient({ phone: v })} placeholder="Telefonnummer" type="tel" />
              <EditableField label="Website" value={client.website} icon={Globe} onSave={(v) => patchClient({ website: v })} placeholder="https://" type="url" />
              <div className="sm:col-span-2">
                <EditableField label="Adresse" value={client.address} icon={MapPin} onSave={(v) => patchClient({ address: v })} placeholder="Straße, PLZ, Ort" />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">CRM</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Lead status */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</Label>
                  <Select value={client.leadStatus ?? "__none__"} onValueChange={(v) => patchClient({ leadStatus: v === "__none__" ? null : v })}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Kein Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Status</SelectItem>
                      {LEAD_STATUSES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lead value */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Deal-Wert (€)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    defaultValue={client.leadValue ?? ""}
                    placeholder="0"
                    onBlur={(e) => patchClient({ leadValue: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>

                {/* Lead source */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Quelle</Label>
                  <Select value={client.leadSource ?? "__none__"} onValueChange={(v) => patchClient({ leadSource: v === "__none__" ? null : v })}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Keine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine</SelectItem>
                      {["Website", "Empfehlung", "Kaltakquise", "Messe", "Social Media", "Sonstiges"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Recent activity sidebar */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Letzte Aktivitäten</h2>
            {activities.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Noch keine Aktivitäten</p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 5).map((act) => {
                  const Icon = activityIcon(act.type);
                  return (
                    <div key={act.id} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug truncate">{act.title}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(act.date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {activities.length > 5 && (
              <button onClick={() => setTab("activities")} className="text-[12px] text-primary hover:underline">
                Alle {activities.length} anzeigen →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Projekte ── */}
      {tab === "projects" && (
        <div className="space-y-3">
          {client.projects.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
              Keine Projekte zugewiesen
            </div>
          ) : (
            client.projects.map(({ project }) => {
              const invoiceTotal = project.invoices.flatMap((i) => i.items).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
              const statusColor = PROJECT_STATUS_COLORS[project.status] ?? "bg-muted text-muted-foreground";
              return (
                <div key={project.id} className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: project.color ? project.color + "22" : undefined }}>
                      <FolderKanban className="h-4 w-4" style={{ color: project.color ?? undefined }} />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/projects/${project.id}/tasks`} className="text-sm font-semibold hover:text-primary transition-colors truncate block">
                        {project.name}
                      </Link>
                      {project.description && <p className="text-[12px] text-muted-foreground truncate">{project.description}</p>}
                      {project.dueDate && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Fällig: {formatDate(project.dueDate)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", statusColor)}>{project.status}</span>
                    {invoiceTotal > 0 && (
                      <span className="text-[12px] text-muted-foreground font-mono">{formatEur(invoiceTotal)}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{project.invoices.length} Rechnungen</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Tab: Aktivitäten ── */}
      {tab === "activities" && (
        <div className="space-y-4">
          {/* Add activity */}
          {!actOpen ? (
            <Button variant="outline" size="sm" onClick={() => setActOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Aktivität erfassen
            </Button>
          ) : (
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Neue Aktivität</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Typ</Label>
                  <Select value={actForm.type} onValueChange={(v) => setActForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Datum & Zeit</Label>
                  <Input type="datetime-local" className="h-8 text-sm" value={actForm.date}
                    onChange={(e) => setActForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Titel *</Label>
                  <Input className="h-8 text-sm" placeholder="Kurze Beschreibung der Aktivität" value={actForm.title}
                    onChange={(e) => setActForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Notizen</Label>
                  <Textarea rows={2} className="text-sm resize-none" placeholder="Details, nächste Schritte..." value={actForm.description}
                    onChange={(e) => setActForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dauer (Minuten)</Label>
                  <Input type="number" className="h-8 text-sm" placeholder="30" value={actForm.duration}
                    onChange={(e) => setActForm((f) => ({ ...f, duration: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ergebnis</Label>
                  <Select value={actForm.outcome} onValueChange={(v) => setActForm((f) => ({ ...f, outcome: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Kein Ergebnis" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Ergebnis</SelectItem>
                      {OUTCOME_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={saveActivity} disabled={savingAct || !actForm.title.trim()}>
                  {savingAct ? "Speichern..." : "Speichern"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setActOpen(false)}>Abbrechen</Button>
              </div>
            </div>
          )}

          {/* Activity list */}
          {activities.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Noch keine Aktivitäten erfasst
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />
              <div className="space-y-1">
                {activities.map((act) => {
                  const Icon = activityIcon(act.type);
                  const oc = outcomeColor(act.outcome);
                  return (
                    <div key={act.id} className="relative flex gap-4 pl-10 group">
                      {/* Dot */}
                      <div className="absolute left-0 flex h-10 items-center">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-sm">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 rounded-lg border bg-card p-3.5 space-y-1 my-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{activityLabel(act.type)}</span>
                            {act.outcome && <span className={cn("ml-2 text-[11px] font-medium", oc)}>· {OUTCOME_OPTIONS.find((o) => o.value === act.outcome)?.label}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground">{formatDate(act.date)}</span>
                            {act.duration && (
                              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                <Clock className="h-3 w-3" />{act.duration}min
                              </span>
                            )}
                            <button
                              onClick={() => deleteActivity(act.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-medium">{act.title}</p>
                        {act.description && <p className="text-[13px] text-muted-foreground leading-relaxed">{act.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Notizen ── */}
      {tab === "notes" && (
        <div className="space-y-4">
          {/* Note editor */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Input
              placeholder="Titel (optional)"
              className="border-0 bg-transparent p-0 text-sm font-semibold focus-visible:ring-0 placeholder:text-muted-foreground/50"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <Textarea
              placeholder="Notiz schreiben…"
              rows={3}
              className="border-0 bg-transparent p-0 text-sm resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            <div className="flex justify-end border-t pt-3">
              <Button size="sm" onClick={saveNote} disabled={savingNote || !noteContent.trim()}>
                {savingNote ? "Speichern..." : "Notiz speichern"}
              </Button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Noch keine Notizen
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    "group rounded-xl border bg-card p-4 space-y-2 relative",
                    note.pinned && "border-primary/30 bg-primary/3"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {note.title && <p className="text-sm font-semibold truncate">{note.title}</p>}
                      <p className="text-[11px] text-muted-foreground">{formatDate(note.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => togglePin(note)} className="text-muted-foreground hover:text-primary transition-colors" title={note.pinned ? "Loslösen" : "Anheften"}>
                        {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {note.pinned && <Pin className="absolute top-3 right-3 h-3 w-3 text-primary opacity-40" />}
                  <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Rechnungen ── */}
      {tab === "invoices" && (
        <div className="space-y-3">
          {allInvoices.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Keine Rechnungen vorhanden
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["DRAFT", "SENT", "PAID", "CANCELLED"] as const).map((s) => {
                  const count = allInvoices.filter((i) => i.status === s).length;
                  const total = allInvoices.filter((i) => i.status === s).flatMap((i) => i.items).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                  const labels: Record<string, string> = { DRAFT: "Entwurf", SENT: "Gesendet", PAID: "Bezahlt", CANCELLED: "Storniert" };
                  const colors: Record<string, string> = { DRAFT: "text-muted-foreground", SENT: "text-blue-400", PAID: "text-emerald-500", CANCELLED: "text-red-400" };
                  return (
                    <div key={s} className="rounded-xl border bg-card p-3 text-center">
                      <div className={cn("text-lg font-bold", colors[s])}>{count}</div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{labels[s]}</div>
                      {total > 0 && <div className="text-[12px] text-muted-foreground mt-0.5">{formatEur(total)}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Invoice rows */}
              <div className="rounded-xl border bg-card divide-y">
                {allInvoices.map((inv) => {
                  const total = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                  const statusColors: Record<string, string> = {
                    DRAFT: "bg-muted text-muted-foreground",
                    SENT: "bg-blue-500/15 text-blue-400",
                    PAID: "bg-emerald-500/15 text-emerald-500",
                    CANCELLED: "bg-red-500/15 text-red-400",
                  };
                  const statusLabels: Record<string, string> = { DRAFT: "Entwurf", SENT: "Gesendet", PAID: "Bezahlt", CANCELLED: "Storniert" };
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {inv.status === "PAID" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="text-sm font-medium truncate">{inv.projectName}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusColors[inv.status] ?? "bg-muted text-muted-foreground")}>
                          {statusLabels[inv.status] ?? inv.status}
                        </span>
                        <span className="text-sm font-mono font-semibold">{formatEur(total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
