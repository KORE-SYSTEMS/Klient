-- Add Task.parentId for self-referential subtasks. Cascade ensures children
-- die with their parent. SQLite supports column-level FK refs to the same
-- table, but ALTER TABLE ADD COLUMN with FK is iffy in older SQLite — we
-- use the rebuild pattern Prisma generates for safety.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Task" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "status"          TEXT NOT NULL DEFAULT 'BACKLOG',
  "priority"        TEXT NOT NULL DEFAULT 'MEDIUM',
  "clientVisible"   BOOLEAN NOT NULL DEFAULT false,
  "dueDate"         DATETIME,
  "order"           INTEGER NOT NULL DEFAULT 0,
  "projectId"       TEXT NOT NULL,
  "assigneeId"      TEXT,
  "epicId"          TEXT,
  "approvalStatus"  TEXT,
  "handoffComment"  TEXT,
  "approvalComment" TEXT,
  "approvedAt"      DATETIME,
  "approvedById"    TEXT,
  "parentId"        TEXT,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       DATETIME NOT NULL,
  CONSTRAINT "Task_projectId_fkey"  FOREIGN KEY ("projectId")  REFERENCES "Project"("id") ON DELETE CASCADE   ON UPDATE CASCADE,
  CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id")    ON DELETE SET NULL  ON UPDATE CASCADE,
  CONSTRAINT "Task_epicId_fkey"     FOREIGN KEY ("epicId")     REFERENCES "Epic"("id")    ON DELETE SET NULL  ON UPDATE CASCADE,
  CONSTRAINT "Task_parentId_fkey"   FOREIGN KEY ("parentId")   REFERENCES "Task"("id")    ON DELETE CASCADE   ON UPDATE CASCADE
);

INSERT INTO "new_Task" (
  "id", "title", "description", "status", "priority", "clientVisible",
  "dueDate", "order", "projectId", "assigneeId", "epicId",
  "approvalStatus", "handoffComment", "approvalComment", "approvedAt", "approvedById",
  "createdAt", "updatedAt"
)
SELECT
  "id", "title", "description", "status", "priority", "clientVisible",
  "dueDate", "order", "projectId", "assigneeId", "epicId",
  "approvalStatus", "handoffComment", "approvalComment", "approvedAt", "approvedById",
  "createdAt", "updatedAt"
FROM "Task";

DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";

CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

PRAGMA foreign_keys=ON;
