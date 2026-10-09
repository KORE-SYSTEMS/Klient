"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DatabaseBackup, Download, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmDialog } from "@/components/confirm-dialog";
import { api, run } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { formatFileSize } from "@/lib/utils";

type Kind = "auto" | "manual" | "pre-update";

interface BackupInfo {
  name: string;
  kind: Kind;
  size: number;
  createdAt: string;
}

interface Settings {
  autoEnabled: boolean;
  autoHour: number;
  keepAuto: number;
  keepPreUpdate: number;
  includeUploads: boolean;
}

interface BackupResponse {
  dir: string;
  settings: Settings;
  backups: BackupInfo[];
}

const KIND_LABEL: Record<Kind, string> = {
  auto: "Automatisch",
  manual: "Manuell",
  "pre-update": "Vor Update",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export default function BackupSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<BackupResponse | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<BackupResponse>("/api/system/backups", { noDedupe: true });
      setData(res);
      setSettings((prev) => prev ?? res.settings);
    } catch {
      toast({ title: "Backups konnten nicht geladen werden", variant: "destructive" });
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    load();
  }, [status, session, router, load]);

  async function createNow() {
    setCreating(true);
    const created = await run(api("/api/system/backups", { method: "POST" }), {
      success: "Backup erstellt",
      error: "Backup fehlgeschlagen",
    });
    setCreating(false);
    if (created !== null) load();
  }

  async function remove(b: BackupInfo) {
    if (!(await confirmDialog({ title: "Backup löschen?", description: b.name }))) return;
    const ok = await run(api(`/api/system/backups/${b.name}`, { method: "DELETE" }), {
      error: "Backup konnte nicht gelöscht werden",
    });
    if (ok !== null) load();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const saved = await run(api<Settings>("/api/system/backups", { method: "PATCH", body: settings }), {
      success: "Einstellungen gespeichert",
      error: "Einstellungen konnten nicht gespeichert werden",
    });
    setSaving(false);
    if (saved) {
      setSettings(saved);
      load();
    }
  }

  if (!data || !settings) {
    return <div className="text-muted-foreground p-6">Lade Backups…</div>;
  }

  const num = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((s) => (s ? { ...s, [key]: Number(e.target.value) } : s));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Backup</h1>
        <p className="text-muted-foreground">
          Sicherungen von Datenbank und Uploads, gespeichert in <code className="text-xs">{data.dir}</code>
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-base flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4 text-muted-foreground" />
              Sicherungen
            </CardTitle>
            <CardDescription>
              Vor jedem Update über die App wird automatisch eine Sicherung erstellt.
            </CardDescription>
          </div>
          <Button onClick={createNow} disabled={creating} className="gap-2 shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
            {creating ? "Wird erstellt…" : "Jetzt sichern"}
          </Button>
        </CardHeader>
        <CardContent>
          {data.backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Backups vorhanden.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {data.backups.map((b) => (
                <div key={b.name} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{formatDateTime(b.createdAt)}</div>
                    <div className="text-xs text-muted-foreground truncate">{b.name}</div>
                  </div>
                  <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {KIND_LABEL[b.kind]}
                  </span>
                  <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                    {formatFileSize(b.size)}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={`/api/system/backups/${b.name}`} download title="Herunterladen">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(b)}
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={saveSettings}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Automatische Sicherung</CardTitle>
            <CardDescription>Einmal täglich, sobald die eingestellte Uhrzeit erreicht ist.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Täglich automatisch sichern</Label>
              </div>
              <Switch
                checked={settings.autoEnabled}
                onCheckedChange={(v) => setSettings({ ...settings, autoEnabled: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Uploads mitsichern</Label>
                <p className="text-xs text-muted-foreground">
                  Dateien aus dem Projekt-Dateibereich. Erhöht die Backup-Größe.
                </p>
              </div>
              <Switch
                checked={settings.includeUploads}
                onCheckedChange={(v) => setSettings({ ...settings, includeUploads: v })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="autoHour">Ab Uhrzeit (0–23)</Label>
                <Input id="autoHour" type="number" min={0} max={23} value={settings.autoHour} onChange={num("autoHour")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keepAuto">Automatische behalten</Label>
                <Input id="keepAuto" type="number" min={1} max={60} value={settings.keepAuto} onChange={num("keepAuto")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keepPre">Vor-Update-Sicherungen behalten</Label>
                <Input id="keepPre" type="number" min={1} max={30} value={settings.keepPreUpdate} onChange={num("keepPreUpdate")} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Manuelle Backups werden nie automatisch gelöscht.
            </p>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Speichern
            </Button>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wiederherstellen</CardTitle>
          <CardDescription>
            Bewusst manuell, weil dabei die laufende Datenbank ersetzt wird. Backup herunterladen und im Container
            (Unraid: Konsole des Containers) ausführen:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">{`# 1. Backup in den Container legen (z. B. nach ${data.dir}) und entpacken
mkdir /tmp/restore && tar -xzf ${data.dir}/<backup-datei>.tar.gz -C /tmp/restore

# 2. Container stoppen (Unraid: Container → Stop), dann DB ersetzen
cp /tmp/restore/klient.db /app/data/klient.db

# 3. Uploads zurückspielen (falls im Backup enthalten)
cp -r /tmp/restore/uploads/. /app/uploads/

# 4. Container wieder starten`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
