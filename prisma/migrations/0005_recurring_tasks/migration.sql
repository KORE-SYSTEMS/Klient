-- Wiederkehrende Tasks: einfaches recurrenceRule-Feld als JSON-String.
-- Wenn gesetzt und der Task wird in DONE-Category verschoben, legt der
-- Server eine Folge-Instanz mit neu berechnetem dueDate an.
ALTER TABLE "Task" ADD COLUMN "recurrenceRule" TEXT;
