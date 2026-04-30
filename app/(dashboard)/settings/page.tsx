"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Palette,
  Building2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { UpdateManager } from "@/components/update-manager";

// ─── Design Sets ─────────────────────────────────────────────────────────────

const DESIGN_SETS: { name: string; label: string; color: string; description: string }[] = [
  { name: "flame",   label: "Flame",   color: "#E8520A", description: "Warm & energetisch" },
  { name: "indigo",  label: "Indigo",  color: "#6366F1", description: "Professionell & ruhig" },
  { name: "violet",  label: "Violett", color: "#8B5CF6", description: "Kreativ & modern" },
  { name: "rose",    label: "Rose",    color: "#EC4899", description: "Frisch & lebendig" },
  { name: "crimson", label: "Rot",     color: "#EF4444", description: "Mutig & klar" },
  { name: "amber",   label: "Amber",   color: "#F59E0B", description: "Warm & freundlich" },
  { name: "emerald", label: "Smaragd", color: "#10B981", description: "Natürlich & frisch" },
  { name: "teal",    label: "Petrol",  color: "#14B8A6", description: "Ruhig & ausgewogen" },
  { name: "blue",    label: "Blau",    color: "#3B82F6", description: "Vertrauenswürdig" },
  { name: "sky",     label: "Himmel",  color: "#0EA5E9", description: "Offen & klar" },
  { name: "slate",   label: "Grau",    color: "#64748B", description: "Dezent & neutral" },
  { name: "zinc",    label: "Dunkel",  color: "#18181B", description: "Minimalistisch" },
];

const EXTRA_COLORS = [
  "#E8520A", "#6366F1", "#8B5CF6", "#EC4899",
  "#EF4444", "#F59E0B", "#10B981", "#14B8A6",
  "#3B82F6", "#0EA5E9", "#64748B", "#18181B",
];

// ─── Color swatch — square, ring on select, no scale ─────────────────────────

function ColorSwatch({
  color,
  selected,
  onClick,
  size = "md",
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-lg border-2 transition-all flex items-center justify-center",
        size === "md" ? "h-9 w-9" : "h-7 w-7",
        selected
          ? "border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background"
          : "border-transparent hover:border-foreground/30"
      )}
      style={{ backgroundColor: color }}
      title={color}
    >
      {selected && (
        <Check
          className={cn(
            "drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]",
            size === "md" ? "h-4 w-4" : "h-3 w-3"
          )}
          style={{ color: getContrastColor(color) }}
        />
      )}
    </button>
  );
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? "#000000" : "#ffffff";
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

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
  const [customHex, setCustomHex] = useState(settings.primaryColor);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") { router.push("/dashboard"); return; }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) { setSettings(data); setCustomHex(data.primaryColor); }
        setLoading(false);
      });
    checkVersion();
  }, [session, router]);

  async function checkVersion() {
    setVersionLoading(true);
    try {
      const res = await fetch("/api/system/version");
      if (res.ok) setVersion(await res.json());
    } catch { /* offline */ }
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

  function setColor(c: string) {
    setSettings((s) => ({ ...s, primaryColor: c }));
    setCustomHex(c);
  }

  const activeSet = DESIGN_SETS.find(
    (s) => s.color.toLowerCase() === settings.primaryColor.toLowerCase()
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Workspace und Darstellung konfigurieren</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">

        {/* ── Workspace ───────────────────────────────────────────────────── */}
        <Section icon={Building2} title="Workspace" description="Name und Logo deines Workspaces">
          <div className="space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-caption uppercase tracking-wider text-muted-foreground font-medium">
                Workspace-Name
              </Label>
              <Input
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="max-w-sm"
                placeholder="Mein Workspace"
              />
            </div>

            {/* Logo */}
            <div className="space-y-1.5">
              <Label className="text-caption uppercase tracking-wider text-muted-foreground font-medium">
                Logo
              </Label>
              <div className="flex items-center gap-4">
                <div className="h-14 w-28 flex items-center justify-center rounded-xl border bg-muted/50 overflow-hidden shrink-0">
                  {settings.logo ? (
                    <img src={settings.logo} className="h-11 max-w-[104px] object-contain" alt="Logo" />
                  ) : (
                    <span className="text-xs text-muted-foreground/60">Kein Logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Hochladen
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast({ title: "Logo darf max. 2 MB groß sein", variant: "destructive" });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => setSettings({ ...settings, logo: ev.target?.result as string });
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {settings.logo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => setSettings({ ...settings, logo: null })}
                      className="h-8 text-xs text-destructive hover:text-destructive justify-start px-3"
                    >
                      <X className="mr-1.5 h-3 w-3" />Entfernen
                    </Button>
                  )}
                  <span className="text-caption text-muted-foreground">PNG, SVG oder JPEG · max. 2 MB</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Design Sets ─────────────────────────────────────────────────── */}
        <Section
          icon={Palette}
          title="Design"
          description={activeSet ? `Aktiv: ${activeSet.label} · ${activeSet.description}` : "Wähle eine Farbkombination für die Oberfläche"}
        >
          <div className="space-y-5">

            {/* Preset grid */}
            <div>
              <p className="text-caption uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Design-Sets
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {DESIGN_SETS.map((set) => {
                  const selected = settings.primaryColor.toLowerCase() === set.color.toLowerCase();
                  return (
                    <button
                      key={set.name}
                      type="button"
                      onClick={() => setColor(set.color)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                        selected
                          ? "border-foreground/40 bg-accent"
                          : "border-transparent bg-muted/40 hover:bg-muted hover:border-border"
                      )}
                    >
                      <div
                        className="h-8 w-8 shrink-0 rounded-lg shadow-sm"
                        style={{ backgroundColor: set.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{set.label}</div>
                        <div className="text-meta text-muted-foreground truncate">{set.description}</div>
                      </div>
                      {selected && (
                        <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
                          <Check className="h-2.5 w-2.5 text-background" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Custom color */}
            <div>
              <p className="text-caption uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Eigene Farbe
              </p>
              <div className="space-y-3">
                {/* Swatches — squares, no overlap */}
                <div className="flex flex-wrap gap-2">
                  {EXTRA_COLORS.map((c) => (
                    <ColorSwatch
                      key={c}
                      color={c}
                      selected={settings.primaryColor.toLowerCase() === c.toLowerCase()}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>

                {/* Hex input */}
                <div className="flex items-center gap-2 max-w-[200px]">
                  <div
                    className="h-9 w-9 shrink-0 rounded-lg border"
                    style={{ backgroundColor: settings.primaryColor }}
                  />
                  <Input
                    value={customHex}
                    maxLength={7}
                    onChange={(e) => {
                      let v = e.target.value;
                      if (!v.startsWith("#")) v = "#" + v;
                      setCustomHex(v);
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) setColor(v);
                    }}
                    onBlur={() => {
                      if (/^#[0-9a-fA-F]{6}$/.test(customHex)) setColor(customHex);
                      else setCustomHex(settings.primaryColor);
                    }}
                    className="font-mono text-sm h-9"
                    placeholder="#E8520A"
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Version & Updates ───────────────────────────────────────────── */}
        <Section
          icon={Zap}
          title="Version & Updates"
          description={`Installiert: v${version?.current || process.env.NEXT_PUBLIC_APP_VERSION || "?"}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {version && !version.updateAvailable && version.latest && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-caption font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />Aktuell
                  </span>
                )}
                {version?.updateAvailable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-caption font-semibold text-primary">
                    <AlertCircle className="h-3 w-3" />Update verfügbar · v{version.latest?.version}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={checkVersion}
                disabled={versionLoading}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw className={cn("h-3 w-3", versionLoading && "animate-spin")} />
                Prüfen
              </Button>
            </div>

            {version?.updateAvailable && version.latest && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">
                      v{version.latest.version}{version.latest.name && ` — ${version.latest.name}`}
                    </div>
                    {version.latest.publishedAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(version.latest.publishedAt).toLocaleDateString("de-DE")}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {version.latest.url && (
                      <a href={version.latest.url} target="_blank" rel="noopener noreferrer">
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                          <ExternalLink className="h-3 w-3" />Release
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
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-border/50 pt-3">
                    {version.latest.changelog.slice(0, 500)}
                    {version.latest.changelog.length > 500 && "…"}
                  </div>
                )}
              </div>
            )}

            {version && !version.latest && (
              <p className="text-xs text-muted-foreground">
                GitHub nicht erreichbar. Bitte Internetverbindung prüfen.
              </p>
            )}
          </div>
        </Section>

        {/* Save */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="gap-2 min-w-[120px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </form>
    </div>
  );
}
