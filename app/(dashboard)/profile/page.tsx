"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    company: "",
    newPassword: "",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setProfile({
            name: data.name || "",
            email: data.email || "",
            company: data.company || "",
            newPassword: "",
          });
        }
        setLoading(false);
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const body = {
      name: profile.name,
      email: profile.email,
      company: profile.company,
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
      setProfile((prev) => ({ ...prev, newPassword: "" }));
      router.refresh();
    } else {
      const data = await res.json();
      toast({ title: "Fehler beim Speichern", description: data.error || "Unbekannter Fehler", variant: "destructive" });
    }
  }

  if (loading) return <div className="text-muted-foreground">Lade Profil...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Mein Profil</h1>
        <p className="text-muted-foreground">Verwalte deine E-Mail, deinen Namen und dein Passwort</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
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
    </div>
  );
}
