"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Inbox,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { api, run } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface InboxResponse {
  notifications: Notification[];
  unreadCount: number;
  typeCounts: Record<string, number>;
}

const TYPE_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }
> = {
  MENTION:             { icon: AtSign,         label: "Erwähnung",  tone: "text-violet-400 bg-violet-500/10" },
  TASK_ASSIGNED:       { icon: UserPlus,       label: "Zuweisung",  tone: "text-blue-400 bg-blue-500/10" },
  TASK_STATUS_CHANGED: { icon: ArrowRight,     label: "Status",     tone: "text-orange-400 bg-orange-500/10" },
  TASK_COMMENT:        { icon: MessageSquare,  label: "Kommentar",  tone: "text-yellow-400 bg-yellow-500/10" },
  TASK_FILE_UPLOADED:  { icon: Paperclip,      label: "Datei",      tone: "text-purple-400 bg-purple-500/10" },
  CHAT_MESSAGE:        { icon: MessageCircle,  label: "Chat",       tone: "text-cyan-400 bg-cyan-500/10" },
  TASK_DUE_SOON:       { icon: Clock,          label: "Fällig",     tone: "text-red-400 bg-red-500/10" },
};

type FilterKey = "all" | "unread" | string;

const PRESET_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",    label: "Alle" },
  { key: "unread", label: "Ungelesen" },
];

const TYPE_FILTER_GROUPS: { keys: string[]; label: string }[] = [
  { keys: ["MENTION"],                                label: "Erwähnungen" },
  { keys: ["TASK_ASSIGNED"],                          label: "Zuweisungen" },
  { keys: ["TASK_COMMENT"],                           label: "Kommentare" },
  { keys: ["TASK_DUE_SOON"],                          label: "Fällig" },
  { keys: ["TASK_STATUS_CHANGED", "TASK_FILE_UPLOADED", "CHAT_MESSAGE"], label: "Sonstiges" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "gerade eben";
  const min = Math.floor(sec / 60);
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tag${d === 1 ? "" : "en"}`;
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

export default function InboxPage() {
  const router = useRouter();
  const [data, setData] = useState<InboxResponse>({
    notifications: [], unreadCount: 0, typeCounts: {},
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (filter === "unread") params.set("unreadOnly", "true");
    if (filterTypes.length > 0) params.set("types", filterTypes.join(","));
    try {
      const res = await api<InboxResponse>(`/api/notifications?${params.toString()}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [filter, filterTypes]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    function onVisible() { if (!document.hidden) fetchData(); }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchData);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchData);
    };
  }, [fetchData]);

  // Reset selection when the visible list changes shape
  useEffect(() => { setSelected(new Set()); }, [filter, filterTypes]);

  const visible = data.notifications;

  function selectFilter(key: FilterKey) {
    setFilter(key);
    setFilterTypes([]);
  }

  function selectTypeGroup(keys: string[]) {
    setFilter("all");
    setFilterTypes((prev) =>
      prev.length === keys.length && keys.every((k) => prev.includes(k)) ? [] : keys,
    );
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(visible.map((n) => n.id)));
  }

  async function markRead(ids: string[]) {
    await run(
      Promise.all(
        ids.map((id) =>
          api(`/api/notifications/${id}`, { method: "PATCH", body: { read: true } }),
        ),
      ),
      { success: null, error: "Konnte nicht als gelesen markieren" },
    );
    setSelected(new Set());
    fetchData();
  }

  async function markAllRead() {
    await run(api("/api/notifications", { method: "PATCH" }), {
      success: "Alle als gelesen markiert",
    });
    fetchData();
  }

  async function deleteRead() {
    if (!confirm("Alle gelesenen Benachrichtigungen löschen?")) return;
    await run(api("/api/notifications", { method: "DELETE" }), {
      success: "Gelesene gelöscht",
    });
    fetchData();
  }

  async function deleteOne(id: string) {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => n.id !== id),
    }));
    await run(api(`/api/notifications/${id}`, { method: "DELETE" }), {
      success: null,
      error: "Konnte nicht löschen",
    });
    fetchData();
  }

  function onClickRow(n: Notification) {
    if (selected.size > 0) {
      toggleSelect(n.id);
      return;
    }
    if (!n.read) {
      void api(`/api/notifications/${n.id}`, {
        method: "PATCH", body: { read: true },
      }).catch(() => {});
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((x) =>
          x.id === n.id ? { ...x, read: true } : x,
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.unreadCount > 0
              ? `${data.unreadCount} ungelesen`
              : "Alles gesichtet"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data.unreadCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Alle gelesen
            </Button>
          )}
          {data.notifications.some((n) => n.read) && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={deleteRead}>
              <Trash2 className="h-3.5 w-3.5" />
              Gelesene löschen
            </Button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESET_FILTERS.map((f) => {
          const active = filter === f.key && filterTypes.length === 0;
          const count = f.key === "unread" ? data.unreadCount : null;
          return (
            <button
              key={f.key}
              type="button"
              className={chipCls(active)}
              onClick={() => selectFilter(f.key)}
            >
              {f.label}
              {count !== null && count > 0 && (
                <span className={cn(
                  "ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-meta font-semibold tabular-nums",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary",
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <span className="h-5 w-px bg-border mx-1" aria-hidden />
        {TYPE_FILTER_GROUPS.map((g) => {
          const active = filterTypes.length === g.keys.length &&
            g.keys.every((k) => filterTypes.includes(k));
          const count = g.keys.reduce((sum, k) => sum + (data.typeCounts[k] || 0), 0);
          return (
            <button
              key={g.label}
              type="button"
              className={chipCls(active)}
              onClick={() => selectTypeGroup(g.keys)}
            >
              {g.label}
              {count > 0 && (
                <span className={cn(
                  "ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-meta font-semibold tabular-nums",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bulk action bar (when selection > 0) */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-semibold tabular-nums">
            {selected.size} ausgewählt
          </span>
          <span className="h-5 w-px bg-border" aria-hidden />
          <Button
            variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"
            onClick={() => markRead(Array.from(selected))}
          >
            <Check className="h-3.5 w-3.5" />
            Als gelesen
          </Button>
          {visible.length > selected.size && (
            <Button
              variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={selectAll}
            >
              Alle ({visible.length})
            </Button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Auswahl aufheben"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="rounded-lg border divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-2.5 w-72" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            filter === "unread"
              ? "Alles gelesen"
              : filterTypes.length > 0
                ? "Nichts in dieser Kategorie"
                : "Inbox ist leer"
          }
          description={
            filter === "unread"
              ? "Du bist auf dem aktuellen Stand."
              : "Hier landen Erwähnungen, Zuweisungen und andere Updates."
          }
        />
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          {visible.map((n) => {
            const meta = TYPE_META[n.type] || { icon: Bell, label: n.type, tone: "text-muted-foreground bg-muted" };
            const Icon = meta.icon;
            const isSelected = selected.has(n.id);
            return (
              <div
                key={n.id}
                className={cn(
                  "group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer",
                  !n.read && "bg-primary/5",
                  isSelected && "bg-accent",
                  !isSelected && "hover:bg-accent/50",
                )}
                onClick={() => onClickRow(n)}
              >
                {/* Checkbox (visible on hover or when selection active) */}
                <button
                  type="button"
                  className={cn(
                    "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity",
                    selected.size > 0 || isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 hover:border-foreground",
                  )}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(n.id); }}
                  aria-label={isSelected ? "Abwählen" : "Auswählen"}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </button>

                {/* Type icon */}
                <div className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  meta.tone,
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={cn("text-sm leading-tight", !n.read && "font-semibold")}>
                      {n.title}
                    </span>
                    <span className="text-meta uppercase tracking-wider text-muted-foreground/60">
                      {meta.label}
                    </span>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
                  </div>
                  {n.message && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  )}
                  <p className="mt-0.5 text-meta text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>

                {/* Hover delete */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteOne(n.id); }}
                  className="hover-action mt-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Löschen"
                  aria-label="Benachrichtigung löschen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function chipCls(active: boolean) {
  return cn(
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}
