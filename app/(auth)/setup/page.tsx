"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Klient");

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data) => {
        if (!data.setupNeeded) {
          router.replace("/login");
        } else {
          setLoading(false);
        }
      });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, workspaceName }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Setup fehlgeschlagen");
      setSubmitting(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-xl font-bold">Setup abgeschlossen!</h2>
            <p className="text-muted-foreground">Du wirst zum Login weitergeleitet...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/klient-k.png"
              alt="Klient"
              width={120}
              height={120}
              className="h-20 w-auto"
              priority
            />
          </div>
          <div>
            <CardTitle className="text-2xl">Willkommen bei Klient</CardTitle>
            <CardDescription className="mt-2">
              Richte deinen Workspace ein und erstelle deinen Admin-Account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <div className="rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace-Name</Label>
              <Input
                id="workspaceName"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="z.B. Meine Agentur"
              />
              <p className="text-xs text-muted-foreground">
                Der Name deines Unternehmens oder Workspace.
              </p>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium text-sm">Admin-Account</h3>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {submitting ? "Wird eingerichtet..." : "Klient einrichten"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
