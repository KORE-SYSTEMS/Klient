-- Footer-Links für Sidebar (Impressum/Datenschutz)
ALTER TABLE "Workspace" ADD COLUMN "footerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "privacyUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "imprintUrl" TEXT;
