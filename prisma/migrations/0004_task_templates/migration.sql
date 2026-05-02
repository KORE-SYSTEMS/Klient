-- Task-Templates: pro Projekt benannte Vorlagen für schnelles Anlegen
-- häufig wiederholter Tasks (Bug-Report, Onboarding-Call, etc.). Subtasks
-- werden als JSON-Array hinterlegt — separate Tabelle wäre Overkill bei
-- der erwarteten Größe.

CREATE TABLE "TaskTemplate" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "priority"      TEXT NOT NULL DEFAULT 'MEDIUM',
  "statusId"      TEXT,
  "epicId"        TEXT,
  "subtaskTitles" TEXT NOT NULL DEFAULT '[]',
  "projectId"     TEXT NOT NULL,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL,
  CONSTRAINT "TaskTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TaskTemplate_projectId_idx" ON "TaskTemplate"("projectId");
