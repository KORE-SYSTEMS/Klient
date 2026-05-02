"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileDown,
  FileJson,
  FileText,
  FileUp,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface ImportExportMenuProps {
  projectId: string;
  /** Aufgerufen nach erfolgreichem Import — Parent kann fetchTasks() triggern. */
  onImported: () => void;
  /** Optional: kompakter "Icon-only" Trigger für volle Toolbars. */
  compact?: boolean;
  /**
   * Wenn true, öffnet sich der File-Picker direkt beim Mount. Wird vom
   * Tasks-Page benutzt, um nach `?import=true` (z.B. nach Projekt-Create)
   * sofort zum Datei-Auswahl-Dialog zu springen.
   */
  autoOpen?: boolean;
}

interface ImportResult {
  created: { topLevel: number; subtasks: number };
  skipped: { row: number; reason: string }[];
  warnings: { row: number; message: string }[];
  dryRun: boolean;
}

/**
 * Import/Export-Dropdown für die Tasks-Toolbar. Bietet:
 *   - Export als CSV / JSON (echte Daten)
 *   - Sample-Vorlage zum Befüllen
 *   - Datei-Upload (CSV oder JSON) mit Vorschau-Dryrun
 */
export function ImportExportMenu({ projectId, onImported, compact, autoOpen }: ImportExportMenuProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingText, setPendingText] = useState<string>("");
  const [createMissingEpics, setCreateMissingEpics] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-open the file picker once on mount when the parent requests it
  // (e.g. after "Erstellen & Tasks importieren").
  useEffect(() => {
    if (autoOpen) {
      // Wait one frame so the input is mounted and the dialog/page transitions
      // settle before opening the OS file picker.
      const t = setTimeout(() => fileInputRef.current?.click(), 100);
      return () => clearTimeout(t);
    }
  }, [autoOpen]);

  function downloadUrl(format: "csv" | "json", sample = false) {
    const params = new URLSearchParams({ format });
    if (sample) params.set("sample", "true");
    window.location.href = `/api/projects/${projectId}/tasks/export?${params.toString()}`;
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingText(await file.text());
    setDryRunResult(null);
    setImportDialogOpen(true);
    // Reset so picking the same file again retriggers
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function isJson(file: File | null, text: string): boolean {
    if (file?.name.toLowerCase().endsWith(".json")) return true;
    return text.trim().startsWith("[") || text.trim().startsWith("{");
  }

  async function runImport(dryRun: boolean) {
    if (!pendingText) return;
    setBusy(true);
    try {
      const json = isJson(pendingFile, pendingText);
      const params = new URLSearchParams();
      if (dryRun) params.set("dryRun", "true");
      if (createMissingEpics) params.set("createMissingEpics", "true");
      const res = await fetch(
        `/api/projects/${projectId}/tasks/import?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": json ? "application/json" : "text/csv" },
          body: pendingText,
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Import fehlgeschlagen",
          description: err.error || `Status ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const result = (await res.json()) as ImportResult;
      if (dryRun) {
        setDryRunResult(result);
      } else {
        toast({
          title: "Import erfolgreich",
          description: `${result.created.topLevel} Tasks + ${result.created.subtasks} Subtasks angelegt`,
          variant: "success",
        });
        setImportDialogOpen(false);
        setPendingFile(null);
        setPendingText("");
        setDryRunResult(null);
        onImported();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        className="hidden"
        onChange={onFilePicked}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Import / Export">
              <FileDown className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
              <FileDown className="h-3.5 w-3.5" />
              Import / Export
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-meta uppercase tracking-wider text-muted-foreground/70">
            Export
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => downloadUrl("csv")} className="gap-2">
            <FileText className="h-3.5 w-3.5" />
            Alle Tasks als CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadUrl("json")} className="gap-2">
            <FileJson className="h-3.5 w-3.5" />
            Alle Tasks als JSON
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-meta uppercase tracking-wider text-muted-foreground/70">
            Vorlage
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => downloadUrl("csv", true)} className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Beispiel-CSV laden
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-meta uppercase tracking-wider text-muted-foreground/70">
            Import
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={pickFile} className="gap-2">
            <Upload className="h-3.5 w-3.5" />
            CSV / JSON hochladen…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={importDialogOpen} onOpenChange={(o) => { if (!busy) setImportDialogOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-primary" />
              Tasks importieren
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {pendingFile && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{pendingFile.name}</span>
                  <span className="text-meta text-muted-foreground tabular-nums">
                    {(pendingFile.size / 1024).toFixed(1)} KB · {isJson(pendingFile, pendingText) ? "JSON" : "CSV"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Fehlende Epics anlegen</Label>
                <p className="text-meta text-muted-foreground leading-snug">
                  Ein Epic in der Datei, das noch nicht existiert, wird automatisch erstellt.
                </p>
              </div>
              <Switch checked={createMissingEpics} onCheckedChange={setCreateMissingEpics} />
            </div>

            {dryRunResult && (
              <div className="space-y-2">
                <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-medium">
                      {dryRunResult.created.topLevel} Tasks + {dryRunResult.created.subtasks} Subtasks bereit
                    </span>
                  </div>
                </div>
                {dryRunResult.skipped.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 mb-1 font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {dryRunResult.skipped.length} Zeile(n) werden übersprungen
                    </div>
                    <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                      {dryRunResult.skipped.slice(0, 5).map((s, i) => (
                        <li key={i} className="text-muted-foreground">
                          Zeile {s.row}: {s.reason}
                        </li>
                      ))}
                      {dryRunResult.skipped.length > 5 && (
                        <li className="text-muted-foreground/70 italic">
                          … und {dryRunResult.skipped.length - 5} weitere
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {dryRunResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 mb-1 font-medium text-warning">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {dryRunResult.warnings.length} Hinweis(e)
                    </div>
                    <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                      {dryRunResult.warnings.slice(0, 5).map((w, i) => (
                        <li key={i} className="text-muted-foreground">
                          Zeile {w.row}: {w.message}
                        </li>
                      ))}
                      {dryRunResult.warnings.length > 5 && (
                        <li className="text-muted-foreground/70 italic">
                          … und {dryRunResult.warnings.length - 5} weitere
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!dryRunResult && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tipp: Klick erst auf <strong>Vorschau</strong> für eine Validierung — dabei wird nichts geschrieben.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost" onClick={() => setImportDialogOpen(false)} disabled={busy}
            >
              Abbrechen
            </Button>
            {!dryRunResult ? (
              <>
                <Button variant="outline" onClick={() => runImport(true)} disabled={busy || !pendingText}>
                  Vorschau
                </Button>
                <Button onClick={() => runImport(false)} disabled={busy || !pendingText}>
                  {busy ? "Importiere…" : "Direkt importieren"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => runImport(false)}
                disabled={busy || dryRunResult.created.topLevel + dryRunResult.created.subtasks === 0}
              >
                {busy ? "Importiere…" : `${dryRunResult.created.topLevel + dryRunResult.created.subtasks} importieren`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
