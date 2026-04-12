"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2 } from "lucide-react";
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
  }, [session, router]);

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
        <p className="text-muted-foreground">Workspace und SMTP konfigurieren</p>
      </div>

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
    </div>
  );
}
