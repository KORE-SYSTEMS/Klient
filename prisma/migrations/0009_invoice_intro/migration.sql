-- Einleitungstext für Rechnungen + Angebote.
-- Erscheint im PDF unter dem Titel ("Wir bedanken uns für Ihren Auftrag...").

-- Workspace-Defaults
ALTER TABLE "Workspace" ADD COLUMN "defaultInvoiceIntro" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "defaultProposalIntro" TEXT;

-- Per-Invoice/Proposal Override
ALTER TABLE "Invoice"  ADD COLUMN "intro" TEXT;
ALTER TABLE "Proposal" ADD COLUMN "intro" TEXT;
