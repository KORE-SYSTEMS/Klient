-- Zusätzliche Kontaktdaten für die Absender-Zeile auf Rechnungen/Angeboten.
-- E-Mail, Telefon und Website werden in einer kompakten Meta-Zeile unter
-- der Adresse dargestellt.

ALTER TABLE "Workspace" ADD COLUMN "companyEmail"   TEXT;
ALTER TABLE "Workspace" ADD COLUMN "companyPhone"   TEXT;
ALTER TABLE "Workspace" ADD COLUMN "companyWebsite" TEXT;
