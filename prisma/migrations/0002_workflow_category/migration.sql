-- Add `category` to TaskStatus so we can group custom statuses into TODO / IN_PROGRESS / DONE.
-- SQLite: ALTER TABLE ... ADD COLUMN is safe. We default IN_PROGRESS, then back-fill
-- sensible categories for the default template statuses.

ALTER TABLE "TaskStatus" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'IN_PROGRESS';

-- Back-fill for the default-template slugs (project-scoped ids look like `<projectId>_BACKLOG`).
UPDATE "TaskStatus" SET "category" = 'TODO' WHERE "id" LIKE '%\_BACKLOG' ESCAPE '\' OR "id" = 'BACKLOG';
UPDATE "TaskStatus" SET "category" = 'TODO' WHERE "id" LIKE '%\_TODO' ESCAPE '\' OR "id" = 'TODO';
UPDATE "TaskStatus" SET "category" = 'IN_PROGRESS' WHERE "id" LIKE '%\_IN\_PROGRESS' ESCAPE '\' OR "id" = 'IN_PROGRESS';
UPDATE "TaskStatus" SET "category" = 'IN_PROGRESS' WHERE "id" LIKE '%\_IN\_REVIEW' ESCAPE '\' OR "id" = 'IN_REVIEW';
UPDATE "TaskStatus" SET "category" = 'DONE' WHERE "id" LIKE '%\_DONE' ESCAPE '\' OR "id" = 'DONE';

-- Approval columns → IN_PROGRESS (approval is not "done" by itself).
UPDATE "TaskStatus" SET "category" = 'IN_PROGRESS' WHERE "isApproval" = 1;
