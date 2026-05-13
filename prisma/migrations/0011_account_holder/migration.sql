-- Optionaler Kontoinhaber für die Zahlungsinformation auf Rechnungen.
-- Kann vom Firmennamen abweichen (z.B. Privatperson hinter Einzelunternehmen).
-- Fällt der Wert weg, nutzt der Print-Renderer companyName als Fallback.

ALTER TABLE "Workspace" ADD COLUMN "companyAccountHolder" TEXT;
