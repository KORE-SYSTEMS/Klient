-- Performance-Indexe auf häufig gequeryten Foreign Keys und Filter-Spalten.
-- SQLite legt keine impliziten Indexe auf FK-Spalten an. Ohne diese fallen
-- Joins und WHERE-Filter auf Full-Table-Scans zurück. Bei wachsenden
-- Datenmengen (Tasks, TimeEntries, Comments, Activities) ist das der größte
-- Performance-Bottleneck.
--
-- Composite-Indexe sind so geordnet, dass die linke Spalte die selektivste
-- Filter-Spalte ist (z.B. projectId), gefolgt von der häufigsten zweiten
-- Bedingung (parentId + order für Top-Level-Tasks sortiert, etc.).

-- ── User ──────────────────────────────────────────────────────────────────
CREATE INDEX "User_role_idx"        ON "User"("role");
CREATE INDEX "User_leadStatus_idx"  ON "User"("leadStatus");

-- ── Invitation ────────────────────────────────────────────────────────────
CREATE INDEX "Invitation_email_idx"          ON "Invitation"("email");
CREATE INDEX "Invitation_used_expiresAt_idx" ON "Invitation"("used", "expiresAt");

-- ── ClientNote / ClientActivity ───────────────────────────────────────────
CREATE INDEX "ClientNote_clientId_createdAt_idx" ON "ClientNote"("clientId", "createdAt");
CREATE INDEX "ClientNote_authorId_idx"           ON "ClientNote"("authorId");
CREATE INDEX "ClientActivity_clientId_date_idx"  ON "ClientActivity"("clientId", "date");
CREATE INDEX "ClientActivity_authorId_idx"       ON "ClientActivity"("authorId");

-- ── Project / ProjectMember ───────────────────────────────────────────────
CREATE INDEX "Project_archived_updatedAt_idx" ON "Project"("archived", "updatedAt");
CREATE INDEX "Project_status_idx"             ON "Project"("status");
CREATE INDEX "ProjectMember_projectId_idx"    ON "ProjectMember"("projectId");

-- ── TaskStatus ────────────────────────────────────────────────────────────
CREATE INDEX "TaskStatus_projectId_order_idx"    ON "TaskStatus"("projectId", "order");
CREATE INDEX "TaskStatus_projectId_category_idx" ON "TaskStatus"("projectId", "category");

-- ── Epic ──────────────────────────────────────────────────────────────────
CREATE INDEX "Epic_projectId_order_idx" ON "Epic"("projectId", "order");

-- ── Task ──────────────────────────────────────────────────────────────────
-- (projectId, parentId, order) deckt das Kanban/List-Loading ab: alle
-- Top-Level-Tasks eines Projekts sortiert nach order.
CREATE INDEX "Task_projectId_parentId_order_idx" ON "Task"("projectId", "parentId", "order");
-- (projectId, status) für Status-Spalten-Gruppierung im Kanban.
CREATE INDEX "Task_projectId_status_idx"         ON "Task"("projectId", "status");
CREATE INDEX "Task_assigneeId_idx"               ON "Task"("assigneeId");
CREATE INDEX "Task_epicId_idx"                   ON "Task"("epicId");
CREATE INDEX "Task_parentId_idx"                 ON "Task"("parentId");
CREATE INDEX "Task_dueDate_idx"                  ON "Task"("dueDate");
CREATE INDEX "Task_approvalStatus_idx"           ON "Task"("approvalStatus");

-- ── TaskLink ──────────────────────────────────────────────────────────────
CREATE INDEX "TaskLink_sourceTaskId_idx" ON "TaskLink"("sourceTaskId");
CREATE INDEX "TaskLink_targetTaskId_idx" ON "TaskLink"("targetTaskId");

-- ── TimeEntry ─────────────────────────────────────────────────────────────
CREATE INDEX "TimeEntry_taskId_startedAt_idx" ON "TimeEntry"("taskId", "startedAt");
CREATE INDEX "TimeEntry_userId_stoppedAt_idx" ON "TimeEntry"("userId", "stoppedAt");

-- ── FileFolder / File / FileVersion ───────────────────────────────────────
CREATE INDEX "FileFolder_projectId_parentId_idx" ON "FileFolder"("projectId", "parentId");
CREATE INDEX "File_projectId_folderId_idx"       ON "File"("projectId", "folderId");
CREATE INDEX "File_taskId_idx"                   ON "File"("taskId");
CREATE INDEX "File_uploadedById_idx"             ON "File"("uploadedById");
CREATE INDEX "FileVersion_uploadedById_idx"      ON "FileVersion"("uploadedById");

-- ── Update / Message ──────────────────────────────────────────────────────
CREATE INDEX "Update_projectId_createdAt_idx"  ON "Update"("projectId", "createdAt");
CREATE INDEX "Update_authorId_idx"             ON "Update"("authorId");
CREATE INDEX "Message_projectId_createdAt_idx" ON "Message"("projectId", "createdAt");
CREATE INDEX "Message_authorId_idx"            ON "Message"("authorId");

-- ── TaskComment / TaskActivity ────────────────────────────────────────────
CREATE INDEX "TaskComment_taskId_createdAt_idx"  ON "TaskComment"("taskId", "createdAt");
CREATE INDEX "TaskComment_authorId_idx"          ON "TaskComment"("authorId");
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId", "createdAt");
CREATE INDEX "TaskActivity_userId_idx"           ON "TaskActivity"("userId");

-- ── Invoice / InvoiceItem ─────────────────────────────────────────────────
CREATE INDEX "Invoice_projectId_idx"        ON "Invoice"("projectId");
CREATE INDEX "Invoice_status_dueDate_idx"   ON "Invoice"("status", "dueDate");
CREATE INDEX "InvoiceItem_invoiceId_order_idx" ON "InvoiceItem"("invoiceId", "order");
CREATE INDEX "InvoiceItem_timeEntryId_idx"     ON "InvoiceItem"("timeEntryId");

-- ── Proposal / ProposalItem ───────────────────────────────────────────────
CREATE INDEX "Proposal_projectId_idx"          ON "Proposal"("projectId");
CREATE INDEX "Proposal_clientId_idx"           ON "Proposal"("clientId");
CREATE INDEX "Proposal_status_idx"             ON "Proposal"("status");
CREATE INDEX "ProposalItem_proposalId_order_idx" ON "ProposalItem"("proposalId", "order");
