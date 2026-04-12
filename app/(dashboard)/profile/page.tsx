"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Loader2, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    company: "",
    image: "" as string | null,
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
            image: data.image || null,
            newPassword: "",
          });
        }
        setLoading(false);
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
        image: updatedData.image,
      });
      setProfile((prev) => ({ ...prev, newPassword: "" }));
      router.refresh();
    } else {
      const data = await res.json();
      toast({ title: "Fehler beim Speichern", description: data.error || "Unbekannter Fehler", variant: "destructive" });
    }
  }

  if (loading) return <div className="text-muted-foreground">Lade Profil...</div>;

  const initials = getInitials(profile.name || profile.email || "U");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Mein Profil</h1>
        <p className="text-muted-foreground">Verwalte deine E-Mail, deinen Namen und dein Passwort</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Avatar */}
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

        {/* Personal data */}
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

        {/* Password */}
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
