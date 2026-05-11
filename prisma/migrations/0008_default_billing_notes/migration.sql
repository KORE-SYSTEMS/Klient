-- Default-Anmerkungen pro Workspace, werden in neue Rechnungen/Angebote vorbefüllt.
ALTER TABLE "Workspace" ADD COLUMN "defaultInvoiceNotes" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "defaultProposalNotes" TEXT;
