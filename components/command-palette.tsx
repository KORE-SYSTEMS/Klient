"use client";

/**
 * CommandPalette (⌘K / Ctrl+K) — the global spotlight.
 *
 * Opens from anywhere via keyboard shortcut or the topbar trigger. Shows
 * sectioned results (quick actions, projects, tasks, files, clients) ranked by
 * the /api/search endpoint. Full keyboard navigation: ↑/↓ moves, Enter opens,
 * Esc closes. Debounces input and aborts in-flight requests so the list never
 * flickers behind a stale query.
 *
 * Mounted globally in (dashboard)/layout so every page gets it for free.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Search,
  FolderKanban,
  CheckSquare,
  File as FileIcon,
  Users,
  LayoutDashboard,
  Settings,
  Plus,
  CornerDownLeft,
  Command as CmdIcon,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Hit =
  | { type: "action"; id: string; title: string; subtitle?: string; href?: string; onRun?: () => void; icon?: React.ComponentType<{ className?: string }> }
  | { type: "project"; id: string; title: string; subtitle?: string; color?: string | null; href: string }
  | { type: "task"; id: string; title: string; subtitle?: string; status?: string; priority?: string; color?: string | null; href: string }
  | { type: "file"; id: string; title: string; subtitle?: string; mimeType?: string; href: string }
  | { type: "client"; id: string; title: string; subtitle?: string; image?: string | null; href: string };

interface CommandPaletteContext {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const CTX_EVENT = "klient:command-palette-open";

/** Imperative opener so other components can trigger the palette. */
export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CTX_EVENT));
  }
}

export function CommandPalette() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    projects: Hit[];
    tasks: Hit[];
    files: Hit[];
    clients: Hit[];
  }>({ projects: [], tasks: [], files: [], clients: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global keyboard shortcut: Cmd/Ctrl+K toggles, "/" opens when no input focused
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    }
    function onEvent() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener(CTX_EVENT, onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(CTX_EVENT, onEvent);
    };
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({ projects: [], tasks: [], files: [], clients: [] });
      setActiveIndex(0);
    } else {
      // Focus input after dialog animation frame
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ projects: [], tasks: [], files: [], clients: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setResults(data.results || { projects: [], tasks: [], files: [], clients: [] });
        setActiveIndex(0);
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          setResults({ projects: [], tasks: [], files: [], clients: [] });
        }
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => clearTimeout(handle);
  }, [query]);

  // Quick actions always available
  const actions = useMemo<Hit[]>(() => {
    const navActions: Hit[] = [
      { type: "action", id: "nav-dashboard", title: "Dashboard öffnen", subtitle: "/dashboard", href: "/dashboard", icon: LayoutDashboard },
      { type: "action", id: "nav-projects", title: "Projekte öffnen", subtitle: "/projects", href: "/projects", icon: FolderKanban },
    ];
    if (role !== "CLIENT") {
      navActions.push(
        { type: "action", id: "nav-clients", title: "Kunden öffnen", subtitle: "/clients", href: "/clients", icon: Users },
      );
    }
    if (role === "ADMIN") {
      navActions.push(
        { type: "action", id: "nav-settings", title: "Einstellungen", subtitle: "/settings", href: "/settings", icon: Settings },
        { type: "action", id: "new-project", title: "Neues Projekt anlegen", subtitle: "/projects → Neu", href: "/projects?new=1", icon: Plus },
      );
    }
    // Filter by query
    if (!query.trim()) return navActions.slice(0, 4);
    const q = query.toLowerCase();
    return navActions.filter((a) => a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q));
  }, [role, query]);

  const sections = useMemo(() => {
    return [
      { key: "actions", label: "Aktionen", items: actions },
      { key: "projects", label: "Projekte", items: results.projects },
      { key: "tasks", label: "Tasks", items: results.tasks },
      { key: "files", label: "Dateien", items: results.files },
      { key: "clients", label: "Kunden", items: results.clients },
    ].filter((s) => s.items.length > 0);
  }, [actions, results]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const run = useCallback(
    (hit: Hit) => {
      setOpen(false);
      if (hit.type === "action" && hit.onRun) {
        hit.onRun();
        return;
      }
      const href = (hit as any).href as string | undefined;
      if (href) router.push(href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const hit = flat[activeIndex];
      if (hit) {
        e.preventDefault();
        run(hit);
      }
    }
  }

  // Ensure active item scrolls into view
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden max-w-xl top-[20%] translate-y-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Suche Projekte, Tasks, Dateien, Kunden… oder tippe einen Befehl"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Suche leeren"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1">
          {sections.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query.trim()
                ? loading
                  ? "Suche…"
                  : "Keine Treffer. Versuche einen anderen Suchbegriff."
                : "Tippe los, um zu suchen — oder nutze die Pfeiltasten."}
            </div>
          )}

          {sections.map((section) => (
            <div key={section.key} className="py-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {section.label}
              </div>
              {section.items.map((hit) => {
                runningIndex++;
                const idx = runningIndex;
                const active = idx === activeIndex;
                return (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    data-cmd-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => run(hit)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-accent/40"
                    )}
                  >
                    <HitIcon hit={hit} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{hit.title}</div>
                      {hit.subtitle && (
                        <div className="truncate text-xs text-muted-foreground">{hit.subtitle}</div>
                      )}
                    </div>
                    {hit.type === "task" && (hit as any).priority && (
                      <PriorityDot priority={(hit as any).priority} />
                    )}
                    {active && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigieren</span>
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> Öffnen</span>
            <span className="flex items-center gap-1"><Kbd>Esc</Kbd> Schließen</span>
          </div>
          <span className="flex items-center gap-1">
            <CmdIcon className="h-3 w-3" /> <Kbd>K</Kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-background px-1 text-[10px] font-mono">
      {children}
    </kbd>
  );
}

function HitIcon({ hit }: { hit: Hit }) {
  if (hit.type === "action") {
    const Icon = hit.icon || CmdIcon;
    return (
      <div className="h-7 w-7 rounded-sm border bg-muted/40 flex items-center justify-center flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }
  if (hit.type === "project") {
    return (
      <div
        className="h-7 w-7 rounded-sm flex items-center justify-center flex-shrink-0 text-white font-semibold text-[11px]"
        style={{ backgroundColor: hit.color || "#6366F1" }}
      >
        {hit.title.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  if (hit.type === "task") {
    return (
      <div className="h-7 w-7 rounded-sm border flex items-center justify-center flex-shrink-0"
        style={{ borderColor: hit.color || undefined }}
      >
        <CheckSquare className="h-3.5 w-3.5" style={{ color: hit.color || "currentColor" }} />
      </div>
    );
  }
  if (hit.type === "file") {
    return (
      <div className="h-7 w-7 rounded-sm border bg-muted/40 flex items-center justify-center flex-shrink-0">
        <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }
  if (hit.type === "client") {
    return hit.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={hit.image} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
    ) : (
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-muted-foreground">
        {(hit.title || "?").slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return null;
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "URGENT" ? "#EF4444"
    : priority === "HIGH" ? "#F59E0B"
    : priority === "LOW" ? "#64748B"
    : "#6366F1";
  return <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} title={priority} />;
}
