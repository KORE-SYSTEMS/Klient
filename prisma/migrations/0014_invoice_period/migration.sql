-- Manueller Leistungszeitraum pro Rechnung (leer = automatisch aus Zeiteinträgen).
ALTER TABLE "Invoice" ADD COLUMN "periodStart" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "periodEnd" DATETIME;
