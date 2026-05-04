"use client";

/**
 * KeyboardShortcutOverlay
 *
 * Press "?" to open. Shows all global shortcuts in a clean modal.
 * Mounted globally in (dashboard)/layout — works on every page.
 * Also registers all navigation shortcuts via useKeyboardShortcuts.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { openCommandPalette } from "@/components/command-palette";
import { useDensity } from "@/components/density-provider";

interface ShortcutEntry {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUT_DOCS: ShortcutEntry[] = [
  // Navigation
  { keys: ["G", "D"], description: "Dashboard",      category: "Navigation" },
  { keys: ["G", "P"], description: "Projekte",       category: "Navigation" },
  { keys: ["G", "M"], description: "Mein Tag",       category: "Navigation" },
  { keys: ["G", "T"], description: "Meine Tasks",    category: "Navigation" },
  { keys: ["G", "I"], description: "Rechnungen",     category: "Navigation" },
  { keys: ["G", "C"], description: "Kunden",         category: "Navigation" },
  { keys: ["G", "R"], description: "Reports",        category: "Navigation" },
  { keys: ["G", "S"], description: "Einstellungen",  category: "Navigation" },
  // Search
  { keys: ["⌘", "K"], description: "Suche / Command Palette öffnen", category: "Suche" },
  { keys: ["/"],      description: "Suche öffnen", category: "Suche" },
  // Actions
  { keys: ["C"],      description: "Neuer Task (auf Task-Seiten)", category: "Aktionen" },
  { keys: ["D"],      description: "Dichte umschalten", category: "Aktionen" },
  // General
  { keys: ["?"],   description: "Shortcuts anzeigen", category: "Allgemein" },
  { keys: ["Esc"], description: "Dialog schließen",   category: "Allgemein" },
];

/** Custom event broadcasters — pages listen for these to open the right dialog. */
const NEW_TASK_EVENT = "klient:new-task";
export function emitNewTask() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NEW_TASK_EVENT));
  }
}
export const NEW_TASK_EVENT_NAME = NEW_TASK_EVENT;

export function KeyboardShortcutOverlay() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { toggle: toggleDensity } = useDensity();

  useKeyboardShortcuts({
    "?":     () => setOpen((v) => !v),
    "g+d":   () => router.push("/dashboard"),
    "g+p":   () => router.push("/projects"),
    "g+m":   () => router.push("/my-day"),
    "g+t":   () => router.push("/tasks"),
    "g+i":   () => router.push("/invoices"),
    "g+c":   () => { if (role !== "CLIENT") router.push("/clients"); },
    "g+r":   () => { if (role !== "CLIENT") router.push("/reports"); },
    "g+s":   () => { if (role === "ADMIN") router.push("/settings"); },
    "c":     () => emitNewTask(),
    "d":     () => toggleDensity(),
    "meta+k":() => openCommandPalette(),
  });

  const categories = Array.from(new Set(SHORTCUT_DOCS.map((s) => s.category)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-meta uppercase tracking-wider font-medium text-muted-foreground">
                {cat}
              </p>
              <div className="space-y-1">
                {SHORTCUT_DOCS.filter((s) => s.category === cat).map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                    <span className="text-sm text-muted-foreground">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted/50 px-1.5 text-meta font-mono">
                            {k}
                          </kbd>
                          {ki < s.keys.length - 1 && (
                            <span className="text-meta text-muted-foreground">then</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-caption text-muted-foreground mt-2">
          Shortcuts funktionieren nur wenn kein Eingabefeld fokussiert ist.
        </p>
      </DialogContent>
    </Dialog>
  );
}
