"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Euro,
  CreditCard,
  Hash,
  Save,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingSettings {
  // Tab: Firma
  companyName: string;
  companyAddress: string;
  companyTaxId: string;
  companyIban: string;
  // Tab: Abrechnung
  defaultHourlyRate: string;
  defaultTaxRate: string;
  paymentTermsDays: string;
  currency: string;
  // Tab: Nummerierung
  invoicePrefix: string;
  proposalPrefix: string;
}

const DEFAULTS: BillingSettings = {
  companyName: "",
  companyAddress: "",
  companyTaxId: "",
  companyIban: "",
  defaultHourlyRate: "",
  defaultTaxRate: "19",
  paymentTermsDays: "14",
  currency: "EUR",
  invoicePrefix: "RE",
  proposalPrefix: "AN",
};

type TabId = "firma" | "abrechnung" | "nummerierung";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "firma",        label: "Firma",        icon: Building2  },
  { id: "abrechnung",   label: "Abrechnung",   icon: Euro       },
  { id: "nummerierung", label: "Nummerierung", icon: Hash       },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentYear() {
  return new Date().getFullYear();
}

function prefixExample(prefix: string) {
  const p = prefix.trim() || "RE";
  return `${p}-${currentYear()}-001`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillingSettingsPage() {
  const { data: session } = useSession();
  const router            = useRouter();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("firma");

  const [s, setS] = useState<BillingSettings>(DEFAULTS);

  // Redirect non-admins
  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [session, router]);

  // Fetch on mount
  useEffect(() => {
    if (session?.user?.role !== "ADMIN") return;

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setS({
            companyName:       data.companyName       ?? "",
            companyAddress:    data.companyAddress    ?? "",
            companyTaxId:      data.companyTaxId      ?? "",
            companyIban:       data.companyIban       ?? "",
            defaultHourlyRate: data.defaultHourlyRate != null ? String(data.defaultHourlyRate) : "",
            defaultTaxRate:    data.defaultTaxRate    != null ? String(data.defaultTaxRate)    : "19",
            paymentTermsDays:  data.paymentTermsDays  != null ? String(data.paymentTermsDays)  : "14",
            currency:          data.currency          ?? "EUR",
            invoicePrefix:     data.invoicePrefix     ?? "RE",
            proposalPrefix:    data.proposalPrefix    ?? "AN",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:       s.companyName,
          companyAddress:    s.companyAddress,
          companyTaxId:      s.companyTaxId,
          companyIban:       s.companyIban,
          defaultHourlyRate: s.defaultHourlyRate,
          defaultTaxRate:    s.defaultTaxRate,
          paymentTermsDays:  s.paymentTermsDays,
          currency:          s.currency,
          invoicePrefix:     s.invoicePrefix,
          proposalPrefix:    s.proposalPrefix,
        }),
      });

      if (res.ok) {
        toast({ title: "Abrechnungseinstellungen gespeichert", variant: "success" });
      } else {
        toast({ title: "Fehler beim Speichern", variant: "destructive" });
      }
    } catch {
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function field<K extends keyof BillingSettings>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setS((prev) => ({ ...prev, [key]: e.target.value }));
  }

  if (loading) {
    return <div className="text-muted-foreground p-6">Lade Einstellungen…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Abrechnung</h1>
        <p className="text-muted-foreground">Firmendaten, Abrechnungsstandards und Nummerierung konfigurieren</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Firma ── */}
        {activeTab === "firma" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Firmendaten
              </CardTitle>
              <CardDescription>
                Diese Daten erscheinen auf deinen Rechnungen und Angeboten.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Firmenname</Label>
                <Input
                  id="companyName"
                  value={s.companyName}
                  onChange={field("companyName")}
                  placeholder="Muster GmbH"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Adresse</Label>
                <textarea
                  id="companyAddress"
                  value={s.companyAddress}
                  onChange={field("companyAddress")}
                  rows={3}
                  placeholder={"Musterstraße 1\n12345 Musterstadt\nDeutschland"}
                  className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyTaxId">USt-IdNr.</Label>
                  <Input
                    id="companyTaxId"
                    value={s.companyTaxId}
                    onChange={field("companyTaxId")}
                    placeholder="DE123456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyIban" className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    IBAN
                  </Label>
                  <Input
                    id="companyIban"
                    value={s.companyIban}
                    onChange={field("companyIban")}
                    placeholder="DE89 3704 0044 0532 0130 00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Wird als Zahlungsinformation auf Rechnungen angezeigt.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tab: Abrechnung ── */}
        {activeTab === "abrechnung" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                Abrechnungsstandards
              </CardTitle>
              <CardDescription>
                Standardwerte für neue Rechnungen und Angebote.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="defaultHourlyRate">Standard-Stundensatz</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="defaultHourlyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={s.defaultHourlyRate}
                      onChange={field("defaultHourlyRate")}
                      placeholder="95.00"
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Pro Stunde, wird für neue Projekte vorausgefüllt.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultTaxRate">Standard-MwSt.</Label>
                  <Select
                    value={s.defaultTaxRate}
                    onValueChange={(v) => setS((prev) => ({ ...prev, defaultTaxRate: v }))}
                  >
                    <SelectTrigger id="defaultTaxRate">
                      <SelectValue placeholder="MwSt. wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 % (steuerfrei)</SelectItem>
                      <SelectItem value="7">7 % (ermäßigt)</SelectItem>
                      <SelectItem value="19">19 % (Regelsteuersatz)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paymentTermsDays">Zahlungsziel (Tage)</Label>
                  <Input
                    id="paymentTermsDays"
                    type="number"
                    min="0"
                    max="365"
                    value={s.paymentTermsDays}
                    onChange={field("paymentTermsDays")}
                    placeholder="14"
                  />
                  <p className="text-xs text-muted-foreground">
                    Anzahl Tage bis zur Fälligkeit nach Rechnungsstellung.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Währung</Label>
                  <Select
                    value={s.currency}
                    onValueChange={(v) => setS((prev) => ({ ...prev, currency: v }))}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Währung wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                      <SelectItem value="CHF">CHF — Schweizer Franken</SelectItem>
                      <SelectItem value="USD">USD — US-Dollar</SelectItem>
                      <SelectItem value="GBP">GBP — Britisches Pfund</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tab: Nummerierung ── */}
        {activeTab === "nummerierung" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Nummerierung
                </CardTitle>
                <CardDescription>
                  Präfixe für Rechnungs- und Angebotsnummern. Nummern werden automatisch vergeben.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Invoice prefix */}
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Rechnungsnummer-Präfix</Label>
                    <Input
                      id="invoicePrefix"
                      value={s.invoicePrefix}
                      onChange={field("invoicePrefix")}
                      placeholder="RE"
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Beispiel:{" "}
                      <code className="font-mono rounded bg-muted px-1.5 py-0.5 text-foreground">
                        {prefixExample(s.invoicePrefix)}
                      </code>
                    </p>
                  </div>

                  {/* Proposal prefix */}
                  <div className="space-y-2">
                    <Label htmlFor="proposalPrefix">Angebotsnummer-Präfix</Label>
                    <Input
                      id="proposalPrefix"
                      value={s.proposalPrefix}
                      onChange={field("proposalPrefix")}
                      placeholder="AN"
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Beispiel:{" "}
                      <code className="font-mono rounded bg-muted px-1.5 py-0.5 text-foreground">
                        {prefixExample(s.proposalPrefix)}
                      </code>
                    </p>
                  </div>
                </div>

                {/* Info notice */}
                <div className="rounded-lg border border-dashed px-4 py-3 flex items-start gap-3">
                  <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Automatische Vergabe</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Nummern werden automatisch vergeben und fortlaufend hochgezählt, z.{"\u202F"}B.{" "}
                      <code className="font-mono">{prefixExample(s.invoicePrefix)}</code>,{" "}
                      <code className="font-mono">{s.invoicePrefix.trim() || "RE"}-{currentYear()}-002</code>, …
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Save className="mr-2 h-4 w-4" />
            }
            Speichern
          </Button>
        </div>
      </form>
    </div>
  );
}
