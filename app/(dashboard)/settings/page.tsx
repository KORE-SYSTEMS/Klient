"use client";

import { useState, useEffect, useRef } from "react";
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
  Upload,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { UpdateManager } from "@/components/update-manager";

const PRESET_COLORS = [
  "#E8520A", "#6366F1", "#8B5CF6", "#EC4899",
  "#EF4444", "#F59E0B", "#10B981", "#14B8A6",
  "#3B82F6", "#0EA5E9", "#64748B", "#F8FAFC",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [hex, setHex] = useState(value);

  useEffect(() => { setHex(value); }, [value]);

  function commitHex(v: string) {
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { onChange(c); setHex(c); }}
            className={cn(
              "h-8 w-full rounded-sm border-2 transition-all hover:scale-110",
              value === c ? "border-foreground shadow-md scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: c }}
            title={c}
          >
            {value === c && <Check className="h-3 w-3 text-white mx-auto drop-shadow" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-sm border flex-shrink-0" style={{ backgroundColor: value }} />
        <Input
          value={hex}
          maxLength={7}
          onChange={(e) => {
            let v = e.target.value;
            if (!v.startsWith("#")) v = "#" + v;
            setHex(v);
            commitHex(v);
          }}
          onBlur={() => commitHex(hex)}
          className="font-mono text-sm"
          placeholder="#E8520A"
        />
      </div>
    </div>
  );
}

interface WorkspaceSettings {
  name: string;
  logo?: string | null;
  primaryColor: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  inviteEmailSubject: string;
  inviteEmailTemplate: string;
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
    logo: "",
    primaryColor: "#E8520A",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    inviteEmailSubject: "",
    inviteEmailTemplate: "",
  });

  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(true);

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
      toast({ title: "Einstellungen gespeichert", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  if (loading) return <div className="text-muted-foreground">Lade Einstellungen...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground">Workspace und Updates konfigurieren</p>
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
                    <UpdateManager
                      currentVersion={version.current}
                      latestVersion={version.latest.version}
                      onUpdated={checkVersion}
                    />
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
            <div className="space-y-3">
              <Label>Workspace Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-14 w-32 flex items-center justify-center rounded-md border bg-muted overflow-hidden flex-shrink-0">
                  {settings.logo ? (
                    <img src={settings.logo} className="h-12 max-w-[120px] object-contain" alt="Logo" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Kein Logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-2 cursor-pointer rounded-sm border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Logo hochladen
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast({ title: "Fehler", description: "Logo darf max. 2 MB groß sein", variant: "destructive" });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => setSettings({ ...settings, logo: ev.target?.result as string });
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {settings.logo && (
                    <Button variant="outline" size="sm" type="button" onClick={() => setSettings({ ...settings, logo: null })} className="text-destructive hover:text-destructive">
                      <X className="mr-1 h-3 w-3" /> Entfernen
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">PNG, SVG oder JPEG · Max. 2 MB</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Workspace-Name</Label>
              <Input
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="max-w-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Primärfarbe</Label>
              <ColorPicker
                value={settings.primaryColor}
                onChange={(c) => setSettings({ ...settings, primaryColor: c })}
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

    </div>
  );
}
