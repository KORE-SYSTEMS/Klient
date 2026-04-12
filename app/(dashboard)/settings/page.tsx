"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface WorkspaceSettings {
  name: string;
  primaryColor: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

interface VersionInfo {
  current: string;
  latest: {
    version: string;
    name: string;
    publishedAt: string;
    url: string;
    changelog: string;
  } | null;
  updateAvailable: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WorkspaceSettings>({
    name: "Klient",
    primaryColor: "#E8520A",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
  });

  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(true);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSettings(data);
        setLoading(false);
      });
    checkVersion();
  }, [session, router]);

  async function checkVersion() {
    setVersionLoading(true);
    try {
      const res = await fetch("/api/system/version");
      if (res.ok) setVersion(await res.json());
    } catch {
      // offline
    }
    setVersionLoading(false);
  }

  async function triggerUpdate() {
    setUpdating(true);
    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      if (res.ok) {
        toast({ title: "Update gestartet", description: "Das System wird im Hintergrund aktualisiert und startet danach ggf. neu." });
        setUpdateDialogOpen(false);
      } else {
        toast({ title: "Fehler beim Update", description: "Das Update konnte nicht gestartet werden.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Netzwerkfehler", description: "Es gab ein Problem beim Senden der Update-Anfrage.", variant: "destructive" });
    }
    setUpdating(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Einstellungen gespeichert" });
    } else {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  if (loading) return <div className="text-muted-foreground">Lade Einstellungen...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground">Workspace, Updates und SMTP konfigurieren</p>
      </div>

      {/* Version & Updates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Version & Updates</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkVersion}
              disabled={versionLoading}
            >
              <RefreshCw className={`mr-1 h-3 w-3 ${versionLoading ? "animate-spin" : ""}`} />
              Prüfen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Installierte Version</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-heading">
                  v{version?.current || process.env.NEXT_PUBLIC_APP_VERSION || "?"}
                </span>
                {version && !version.updateAvailable && version.latest && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-400">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Aktuell
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {version?.updateAvailable && version.latest && (
            <>
              <Separator />
              <div className="rounded-sm border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <span className="font-medium">Update verfügbar</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">v{version.latest.version}</span>
                      {version.latest.name && ` — ${version.latest.name}`}
                    </div>
                    {version.latest.publishedAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Veröffentlicht: {new Date(version.latest.publishedAt).toLocaleDateString("de-DE")}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-2">
                      Update über Docker: <code className="bg-muted px-1 rounded">docker compose pull && docker compose up -d</code>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {version.latest.url && (
                      <a href={version.latest.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Release
                        </Button>
                      </a>
                    )}
                    <Button size="sm" onClick={() => setUpdateDialogOpen(true)}>
                      <Download className="mr-1 h-3 w-3" />
                      Jetzt updaten
                    </Button>
                  </div>
                </div>

                {version.latest.changelog && (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap border-t border-border/50 pt-3 mt-3">
                    {version.latest.changelog.slice(0, 500)}
                    {version.latest.changelog.length > 500 && "..."}
                  </div>
                )}
              </div>
            </>
          )}

          {version && !version.latest && (
            <p className="text-xs text-muted-foreground">
              Konnte GitHub nicht erreichen. Prüfen Sie Ihre Internetverbindung.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Workspace Settings */}
      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Workspace-Name</Label>
                <Input
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Primärfarbe</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="h-10 w-10 cursor-pointer rounded-sm border bg-transparent"
                  />
                  <Input
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">SMTP / E-Mail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input
                  value={settings.smtpHost || ""}
                  onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input
                  type="number"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SMTP Benutzer</Label>
                <Input
                  value={settings.smtpUser || ""}
                  onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SMTP Passwort</Label>
                <Input
                  type="password"
                  value={settings.smtpPass || ""}
                  onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Absender-Adresse</Label>
              <Input
                type="email"
                value={settings.smtpFrom || ""}
                onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                placeholder="noreply@yourdomain.com"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Speichern
        </Button>
      </form>

      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>System Update durchführen</DialogTitle>
            <DialogDescription>
              Achtung: Bitte stelle sicher, dass du ein Backup deiner Datenbank und deiner Uploads hast, bevor du fortfährst. 
              Deine Einstellungen gehen durch das Update nicht verloren. Das System startet nach erfolgreichem Update neu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)} disabled={updating}>Abbrechen</Button>
            <Button onClick={triggerUpdate} disabled={updating}>
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Update starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
