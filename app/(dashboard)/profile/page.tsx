"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Upload, X, Bell, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getInitials, cn } from "@/lib/utils";

const NOTIFICATION_TYPES: { key: string; label: string; description: string }[] = [
  { key: "Mention", label: "Erwähnungen (@mention)", description: "Wenn dich jemand in einem Kommentar erwähnt" },
  { key: "TaskAssigned", label: "Task zugewiesen", description: "Wenn dir ein Task zugewiesen wird" },
  { key: "TaskStatusChanged", label: "Status geändert", description: "Wenn sich der Status eines Tasks ändert" },
  { key: "TaskComment", label: "Neuer Kommentar", description: "Wenn jemand einen Task kommentiert" },
  { key: "TaskFileUploaded", label: "Datei hochgeladen", description: "Wenn eine Datei auf einem Task hinzugefügt wird" },
  { key: "ChatMessage", label: "Chat-Nachricht", description: "Neue Nachricht im Projekt-Chat" },
  { key: "TaskDueSoon", label: "Task fällig in Kürze", description: "Erinnerung kurz vor dem Fälligkeitsdatum" },
];

type SettingsState = Record<string, boolean>;

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();
  const initialTab = searchParams.get("tab") === "notifications" ? "notifications" : "general";
  const [tab, setTab] = useState(initialTab);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    company: "",
    image: "" as string | null,
    newPassword: "",
  });

  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setProfile({
            name: data.name || "",
            email: data.email || "",
            company: data.company || "",
            image: data.image || null,
            newPassword: "",
          });
        }
        setLoading(false);
      });

    fetch("/api/notifications/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSettings(data);
      });
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Fehler", description: "Bild darf max. 2 MB groß sein", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setProfile((prev) => ({ ...prev, image: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body = {
      name: profile.name,
      email: profile.email,
      company: profile.company,
      image: profile.image,
      newPassword: profile.newPassword || undefined,
    };

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (res.ok) {
      toast({ title: "Profil gespeichert" });
      const updatedData = await res.json();
      await update({
        name: updatedData.name,
        email: updatedData.email,
        image: updatedData.image ? `/api/users/${session?.user?.id || 'me'}/avatar?t=${Date.now()}` : null,
      });
      setProfile((prev) => ({ ...prev, newPassword: "" }));
      router.refresh();
    } else {
      const data = await res.json();
      toast({ title: "Fehler beim Speichern", description: data.error || "Unbekannter Fehler", variant: "destructive" });
    }
  }

  async function updateSetting(field: string, value: boolean) {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...prev, [field]: value });
    setSavingSettings(true);
    const res = await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSavingSettings(false);
    if (!res.ok) {
      setSettings(prev);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  async function setAll(prefix: "inApp" | "email", value: boolean) {
    if (!settings) return;
    const patch: SettingsState = {};
    for (const t of NOTIFICATION_TYPES) patch[`${prefix}${t.key}`] = value;
    const prev = settings;
    setSettings({ ...prev, ...patch });
    setSavingSettings(true);
    const res = await fetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingSettings(false);
    if (!res.ok) {
      setSettings(prev);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  }

  if (loading) return <div className="text-muted-foreground">Lade Profil...</div>;

  const initials = getInitials(profile.name || profile.email || "U");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Mein Profil</h1>
        <p className="text-muted-foreground">Verwalte dein Konto und deine Benachrichtigungen</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">Allgemein</TabsTrigger>
          <TabsTrigger value="notifications">Benachrichtigungen</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <form onSubmit={onSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profilbild</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile.image || undefined} />
                    <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="avatar-upload"
                      className="inline-flex items-center gap-2 cursor-pointer rounded-sm border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Bild hochladen
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleAvatarChange}
                      />
                    </label>
                    {profile.image && (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setProfile((prev) => ({ ...prev, image: null }))}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="mr-1 h-3 w-3" /> Entfernen
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">PNG, JPG oder GIF · Max. 2 MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Persönliche Daten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Dein Vor- und Nachname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Firma (Optional)</Label>
                    <Input
                      id="company"
                      value={profile.company}
                      onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                      placeholder="Deine Firma"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail Adresse</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Passwort ändern</CardTitle>
                <CardDescription>Lass dieses Feld leer, wenn du dein Passwort nicht ändern möchtest.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Mindestens 8 Zeichen"
                    value={profile.newPassword}
                    onChange={(e) => setProfile({ ...profile, newPassword: e.target.value })}
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
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Benachrichtigungs-Einstellungen</CardTitle>
              <CardDescription>
                Wähle pro Ereignis, ob du eine In-App-Benachrichtigung (Glocke) und/oder eine E-Mail erhalten möchtest.
                Änderungen werden automatisch gespeichert.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!settings ? (
                <div className="text-sm text-muted-foreground">Lade Einstellungen...</div>
              ) : (
                <div className="space-y-1">
                  <div className="hidden sm:grid grid-cols-[1fr_80px_80px] items-center gap-4 px-3 pb-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <div>Ereignis</div>
                    <div className="flex items-center justify-center gap-1">
                      <Bell className="h-3 w-3" /> In-App
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Mail className="h-3 w-3" /> E-Mail
                    </div>
                  </div>

                  {NOTIFICATION_TYPES.map((t) => {
                    const inAppKey = `inApp${t.key}`;
                    const emailKey = `email${t.key}`;
                    return (
                      <div
                        key={t.key}
                        className="grid grid-cols-[1fr_80px_80px] items-center gap-4 px-3 py-3 border-b last:border-0"
                      >
                        <div>
                          <div className="text-sm font-medium">{t.label}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </div>
                        <div className="flex justify-center">
                          <Toggle
                            checked={!!settings[inAppKey]}
                            onChange={(v) => updateSetting(inAppKey, v)}
                            disabled={savingSettings}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Toggle
                            checked={!!settings[emailKey]}
                            onChange={(v) => updateSetting(emailKey, v)}
                            disabled={savingSettings}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAll("inApp", true)} disabled={savingSettings}>
                      Alle In-App an
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAll("inApp", false)} disabled={savingSettings}>
                      Alle In-App aus
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAll("email", true)} disabled={savingSettings}>
                      Alle E-Mails an
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setAll("email", false)} disabled={savingSettings}>
                      Alle E-Mails aus
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
