-- Startdatum für Tasks — ermöglicht Timeline/Gantt-Ansicht mit
-- echten Zeitbalken (startDate → dueDate).
ALTER TABLE "Task" ADD COLUMN "startDate" DATETIME;
