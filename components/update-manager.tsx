"use client";

/**
 * UpdateManager — self-update UI for Settings → Version & Updates.
 *
 * Two modes, chosen by /api/system/update GET:
 *   • socket  — live SSE progress while pulling new image + helper recreate.
 *               We detect disconnect + poll /api/system/version for the new
 *               version to come up, then prompt the user to refresh.
 *   • manual  — Copy-command modal with tabs for docker run / docker compose /
 *               Unraid, pre-filled from current install.
 *
 * This component is self-contained and only renders when an update is
 * available (controlled by `version.updateAvailable` from the caller).
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Terminal,
  PackageCheck,
  RotateCw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Capabilities {
  mode: "socket" | "manual";
  socketAvailable: boolean;
  containerName: string | null;
  imageRef: string | null;
  reason?: string;
}

interface UpdateManagerProps {
  currentVersion: string;
  latestVersion: string;
  onUpdated?: () => void;
}

type Stage = "idle" | "start" | "pull" | "recreate" | "waiting" | "done" | "error";

interface PullProgressLine {
  id?: string;
  status?: string;
  progress?: number;
  total?: number;
  raw?: string;
}

export function UpdateManager({ currentVersion, latestVersion, onUpdated }: UpdateManagerProps) {
  const [open, setOpen] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pullLines, setPullLines] = useState<Record<string, PullProgressLine>>({});
  const [statusText, setStatusText] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Load capabilities when dialog opens — cheap, cached
    if (!open || caps) return;
    fetch("/api/system/update").then(async (r) => {
      if (r.ok) setCaps(await r.json());
    });
  }, [open, caps]);

  useEffect(() => {
    // Auto-scroll log
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [pullLines, stage]);

  async function startSocketUpdate() {
    setStage("start");
    setError(null);
    setPullLines({});
    setStatusText("Starte Update…");

    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${msg}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            handleEvent(evt);
          } catch {
            /* ignore malformed */
          }
        }
      }

      // Stream ended cleanly → helper was spawned. Container is going away.
      // Switch to "waiting" and poll version.
      setStage("waiting");
      setStatusText("Container wird neu gestartet. Warte auf neue Version…");
      pollForRevival();
    } catch (e: any) {
      setStage("error");
      setError(e?.message || String(e));
    }
  }

  function handleEvent(evt: any) {
    if (evt.stage === "pull" && evt.id) {
      setStage("pull");
      setStatusText(evt.status || "Pulling…");
      setPullLines((prev) => ({
        ...prev,
        [evt.id]: {
          id: evt.id,
          status: evt.status,
          progress: evt.progress,
          total: evt.total,
          raw: evt.raw,
        },
      }));
    } else if (evt.stage === "recreate") {
      setStage("recreate");
      setStatusText(evt.message || "Recreating container…");
    } else if (evt.stage === "done") {
      setStatusText(evt.message || "Done");
    } else if (evt.stage === "error") {
      setStage("error");
      setError(evt.message);
    } else if (evt.stage === "start") {
      setStage("start");
      setStatusText(`Pulling ${evt.image}…`);
    }
  }

  function pollForRevival() {
    const deadline = Date.now() + 3 * 60_000; // 3 min max
    const tick = async () => {
      if (Date.now() > deadline) {
        setStage("error");
        setError("Timeout: Container kam nicht wieder hoch. Bitte Logs prüfen.");
        return;
      }
      try {
        const r = await fetch("/api/system/version", { cache: "no-store" });
        if (r.ok) {
          const v = await r.json();
          // If the new version is now running (matches latest, or differs from current)
          if (v?.current && v.current !== currentVersion) {
            setStage("done");
            setStatusText(`Update erfolgreich auf v${v.current}`);
            onUpdated?.();
            return;
          }
        }
      } catch {
        /* connection likely dropped — that's expected during recreate */
      }
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 3000);
  }

  const updateAvailable = currentVersion !== latestVersion;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={!updateAvailable}>
        <Download className="mr-1 h-3 w-3" />
        Jetzt updaten
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          // Prevent closing mid-update
          if (!v && (stage === "pull" || stage === "recreate" || stage === "waiting")) return;
          setOpen(v);
          if (!v) {
            setStage("idle");
            setError(null);
            setPullLines({});
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              Update auf v{latestVersion}
            </DialogTitle>
            <DialogDescription>
              Aktuell installiert: v{currentVersion}
            </DialogDescription>
          </DialogHeader>

          {!caps ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Prüfe Update-Methode…
            </div>
          ) : caps.mode === "socket" ? (
            <SocketModeBody
              stage={stage}
              statusText={statusText}
              error={error}
              pullLines={pullLines}
              logRef={logRef}
            />
          ) : (
            <ManualModeBody
              imageRef={caps.imageRef}
              containerName={caps.containerName}
              reason={caps.reason}
            />
          )}

          <DialogFooter>
            {caps?.mode === "socket" && stage === "idle" && (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={startSocketUpdate}>
                  <Download className="mr-2 h-4 w-4" />
                  Update starten
                </Button>
              </>
            )}
            {caps?.mode === "socket" && stage === "error" && (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Schließen
                </Button>
                <Button onClick={startSocketUpdate}>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Erneut versuchen
                </Button>
              </>
            )}
            {caps?.mode === "socket" && stage === "done" && (
              <Button onClick={() => window.location.reload()}>
                <RotateCw className="mr-2 h-4 w-4" />
                Seite neu laden
              </Button>
            )}
            {caps?.mode === "manual" && (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Schließen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SocketModeBody({
  stage,
  statusText,
  error,
  pullLines,
  logRef,
}: {
  stage: Stage;
  statusText: string;
  error: string | null;
  pullLines: Record<string, PullProgressLine>;
  logRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  if (stage === "idle") {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-foreground">Backup empfohlen</p>
            <p className="text-muted-foreground text-xs mt-1">
              Sichere <code className="bg-muted px-1 rounded">/app/data</code> und{" "}
              <code className="bg-muted px-1 rounded">/app/uploads</code>, bevor du
              fortfährst. Deine Einstellungen bleiben erhalten.
            </p>
          </div>
        </div>
        <p className="text-muted-foreground">
          Klient wird das neue Image pullen, den Container stoppen und mit identischer
          Konfiguration neu starten. Der Vorgang dauert meist 20–60 Sekunden.
        </p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Update fehlgeschlagen
        </div>
        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono">{error}</pre>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="rounded-sm border border-green-500/30 bg-green-500/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-green-500">
          <Check className="h-4 w-4" />
          Update erfolgreich
        </div>
        <p className="text-muted-foreground mt-1">{statusText}</p>
      </div>
    );
  }

  const lines = Object.values(pullLines);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {stage === "waiting" ? (
          <RotateCw className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        <span className="font-medium">
          {stage === "start" && "Starte…"}
          {stage === "pull" && "Image wird heruntergeladen"}
          {stage === "recreate" && "Container wird neu erstellt"}
          {stage === "waiting" && "Warte auf Neustart"}
        </span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {statusText}
        </Badge>
      </div>

      {lines.length > 0 && (
        <div
          ref={logRef}
          className="max-h-56 overflow-y-auto rounded-sm border bg-muted/30 p-2 text-xs font-mono space-y-1"
        >
          {lines.map((l) => (
            <LayerLine key={l.id} line={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function LayerLine({ line }: { line: PullProgressLine }) {
  const pct =
    line.progress && line.total
      ? Math.min(100, Math.round((line.progress / line.total) * 100))
      : undefined;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16 truncate">{line.id}</span>
      <span className="flex-1 truncate">{line.status}</span>
      {pct !== undefined ? (
        <div className="w-24">
          <Progress value={pct} className="h-1" />
        </div>
      ) : (
        <span className="text-muted-foreground text-meta">{line.raw}</span>
      )}
    </div>
  );
}

function ManualModeBody({
  imageRef,
  containerName,
  reason,
}: {
  imageRef: string | null;
  containerName: string | null;
  reason?: string;
}) {
  const image = imageRef || "ghcr.io/kore-systems/klient:latest";
  const name = containerName || "klient";

  const commands = {
    compose: `docker compose pull\ndocker compose up -d`,
    run: `docker pull ${image}\ndocker stop ${name} && docker rm ${name}\n# Re-run your original 'docker run' command — data volumes persist`,
    unraid: `# In Unraid UI:\n# 1. Docker → Klient → Force Update\n# Or CLI:\ndocker pull ${image}\ndocker stop ${name} && docker rm ${name}\n# Start container again from the Unraid Docker tab`,
    watchtower: `docker run -d --name watchtower \\\n  -v /var/run/docker.sock:/var/run/docker.sock \\\n  containrrr/watchtower \\\n  --cleanup --interval 86400 ${name}`,
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-2 rounded-sm border border-blue-500/30 bg-blue-500/5 p-3">
        <Terminal className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-foreground">Ein-Klick-Update nicht verfügbar</p>
          <p className="text-muted-foreground text-xs mt-1">
            Für automatische Updates mounte{" "}
            <code className="bg-muted px-1 rounded">/var/run/docker.sock</code>{" "}
            in den Container. Solange kannst du eine der Methoden unten nutzen.
            {reason && (
              <>
                {" "}
                <span className="opacity-60">(Grund: {reason})</span>
              </>
            )}
          </p>
        </div>
      </div>

      <Tabs defaultValue="compose">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="run">Docker Run</TabsTrigger>
          <TabsTrigger value="unraid">Unraid</TabsTrigger>
          <TabsTrigger value="watchtower">Watchtower</TabsTrigger>
        </TabsList>
        {(Object.keys(commands) as (keyof typeof commands)[]).map((k) => (
          <TabsContent key={k} value={k}>
            <CodeBlock code={commands[k]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "In Zwischenablage kopiert", variant: "success" });
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative">
      <pre className="rounded-sm border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
        {code}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 h-7"
        onClick={copy}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}
