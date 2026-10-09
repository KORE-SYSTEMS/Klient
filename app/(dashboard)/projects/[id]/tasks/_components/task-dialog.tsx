"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  X,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { PRIORITIES, PRIORITY_LABELS, getPriorityHex } from "@/lib/task-meta";
import { ApprovalBadge } from "@/components/task/approval-badge";
import { getNextStatus } from "../_lib/dnd";
import { TimeEntriesSection } from "./time-entries-section";
import { ChecklistSection } from "./checklist-section";
import { SubtasksSection } from "./subtasks-section";
import { CommentsSection } from "./comments-section";
import { FilesSection } from "./files-section";
import { ActivityTimeline } from "./activity-timeline";
import { RecurrencePicker } from "./recurrence-picker";
import type { LucideIcon } from "lucide-react";
import type { useGlobalTimer } from "@/components/global-timer";
import type { Task, TaskStatus, Epic } from "../_lib/types";

type ActiveTimer = ReturnType<typeof useGlobalTimer>["activeTimer"];
export type DetailTab = "details" | "comments" | "files" | "activity";

export interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTask: Task | null;
  isClient: boolean;
  isCreateMode: boolean;
  isEditMode: boolean;
  isClientViewingTask: boolean;
  canClientInteract: boolean;
  currentUserId: string;
  projectId: string;
  statuses: TaskStatus[];
  epics: Epic[];
  members: { id: string; name: string; email: string; role?: string }[];
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  fetchTasks: () => Promise<void>;
  detailTab: DetailTab;
  setDetailTab: (tab: DetailTab) => void;
  dialogTabs: { id: DetailTab; label: string; icon: LucideIcon }[];
  saveTask: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  handleNextPhase: (task: Task) => Promise<void>;
  openTaskDialog: (task: Task | null, defaultStatus?: string) => void;
  getStatusInfo: (statusId: string) => TaskStatus | undefined;
  formSubmitting: boolean;
  formTitle: string;
  setFormTitle: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formStatus: string;
  setFormStatus: (v: string) => void;
  formPriority: string;
  setFormPriority: (v: string) => void;
  formStartDate: string;
  setFormStartDate: (v: string) => void;
  formDueDate: string;
  setFormDueDate: (v: string) => void;
  formAssigneeId: string;
  setFormAssigneeId: (v: string) => void;
  formClientVisible: boolean;
  setFormClientVisible: (v: boolean) => void;
  formEpicId: string;
  setFormEpicId: (v: string) => void;
  formRecurrence: string | null;
  setFormRecurrence: (v: string | null) => void;
  formSubtaskTitles: string[];
  setFormSubtaskTitles: React.Dispatch<React.SetStateAction<string[]>>;
  approvalComment: string;
  setApprovalComment: (v: string) => void;
  approvalSubmitting: boolean;
  submitApproval: (decision: "APPROVED" | "REJECTED") => Promise<void>;
  resubmitApproval: () => Promise<void>;
  activeTimer: ActiveTimer;
  elapsed: number;
  handleTimerStart: (taskId: string) => Promise<void>;
  handleTimerStop: () => void;
}

export function TaskDialog({
  open,
  onOpenChange,
  editTask,
  isClient,
  isCreateMode,
  isEditMode,
  isClientViewingTask,
  canClientInteract,
  currentUserId,
  projectId,
  statuses,
  epics,
  members,
  tasks,
  setTasks,
  fetchTasks,
  detailTab,
  setDetailTab,
  dialogTabs,
  saveTask,
  deleteTask,
  handleNextPhase,
  openTaskDialog,
  getStatusInfo,
  formSubmitting,
  formTitle,
  setFormTitle,
  formDescription,
  setFormDescription,
  formStatus,
  setFormStatus,
  formPriority,
  setFormPriority,
  formStartDate,
  setFormStartDate,
  formDueDate,
  setFormDueDate,
  formAssigneeId,
  setFormAssigneeId,
  formClientVisible,
  setFormClientVisible,
  formEpicId,
  setFormEpicId,
  formRecurrence,
  setFormRecurrence,
  formSubtaskTitles,
  setFormSubtaskTitles,
  approvalComment,
  setApprovalComment,
  approvalSubmitting,
  submitApproval,
  resubmitApproval,
  activeTimer,
  elapsed,
  handleTimerStart,
  handleTimerStop,
}: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto overflow-x-hidden", editTask ? "max-w-2xl" : "max-w-lg")}>
        <DialogHeader>
          <DialogTitle>
            {isCreateMode && "Neuer Task"}
            {isEditMode && "Task bearbeiten"}
            {isClientViewingTask && (editTask?.title || "Task")}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        {editTask && (
          <div className="flex items-center gap-1 border-b -mx-6 px-6 mb-2">
            {dialogTabs.map((tab) => (
              <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                  detailTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <tab.icon className="h-3.5 w-3.5" />{tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Workflow strip — current phase + quick "next phase" action */}
        {editTask && !isClient && detailTab === "details" && (() => {
          const current = statuses.find((s) => s.id === editTask.status);
          const next = getNextStatus(editTask.status, statuses);
          const isDone = current?.category === "DONE";
          return (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 mb-3">
              <span className="text-caption font-medium uppercase tracking-wider text-muted-foreground shrink-0">Phase</span>
              {current && (
                <span
                  className="inline-flex items-center gap-1 rounded-full h-5 px-2 text-[10px] leading-none font-medium"
                  style={{ backgroundColor: current.color + "22", color: current.color }}
                >
                  {current.name}
                  {current.isApproval && <ClipboardCheck className="h-2.5 w-2.5" />}
                </span>
              )}
              <div className="flex-1" />
              {next ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => {
                    handleNextPhase(editTask);
                    onOpenChange(false);
                  }}
                >
                  Nächste Phase
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="font-medium" style={{ color: next.color }}>{next.name}</span>
                </Button>
              ) : (
                <span className={cn("inline-flex items-center gap-1 text-caption", isDone ? "text-success" : "text-muted-foreground")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isDone ? "Abgeschlossen" : "Letzte Phase"}
                </span>
              )}
            </div>
          );
        })()}

        {/* Client read-only details */}
        {isClientViewingTask && detailTab === "details" && editTask && (
          <div className="space-y-4">
            <div className="space-y-3">
              {editTask.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{editTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {(() => {
                      const si = getStatusInfo(editTask.status);
                      return si ? (
                        <span className="inline-flex items-center gap-1 rounded-full h-5 px-2 text-[10px] leading-none font-medium"
                          style={{ backgroundColor: si.color + "18", color: si.color }}>
                          {si.name}
                        </span>
                      ) : editTask.status;
                    })()}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Priorität</Label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getPriorityHex(editTask.priority) }} />
                    <span className="text-sm">{PRIORITY_LABELS[editTask.priority] || editTask.priority}</span>
                  </div>
                </div>
                {editTask.dueDate && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Fällig am</Label>
                    <p className="text-sm mt-1">{formatDate(editTask.dueDate)}</p>
                  </div>
                )}
                {editTask.assignee && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Zugewiesen an</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-5 w-5"><AvatarFallback className="text-micro">{getInitials(editTask.assignee.name || editTask.assignee.email)}</AvatarFallback></Avatar>
                      <span className="text-sm">{editTask.assignee.name || editTask.assignee.email}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t mt-4 pt-5">
                <TimeEntriesSection
                  taskId={editTask.id}
                  onUpdate={fetchTasks}
                  isClient={isClient}
                  isTimerActive={activeTimer?.taskId === editTask.id}
                  timerElapsed={activeTimer?.taskId === editTask.id ? elapsed : 0}
                  onTimerStart={handleTimerStart}
                  onTimerStop={handleTimerStop}
                />
              </div>
            </div>

            {/* ── Handoff comment (shown to client when task is in approval) ── */}
            {editTask.handoffComment && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1.5">
                <p className="text-caption font-semibold uppercase tracking-wider text-warning flex items-center gap-1.5">
                  <ClipboardCheck className="h-3 w-3" />Übergabe-Nachricht vom Team
                </p>
                <p className="text-sm whitespace-pre-wrap">{editTask.handoffComment}</p>
              </div>
            )}

            {/* ── Approval action (only if PENDING and assigned to this client) ── */}
            {editTask.approvalStatus === "PENDING" && editTask.assigneeId === currentUserId && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Deine Abnahme
                </p>
                <Textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Optionaler Kommentar zur Abnahme oder Ablehnung…"
                  rows={2}
                  className="resize-none text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => submitApproval("APPROVED")}
                    disabled={approvalSubmitting}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />Genehmigen
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={() => submitApproval("REJECTED")}
                    disabled={approvalSubmitting}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />Ablehnen
                  </Button>
                </div>
              </div>
            )}

            {/* ── Approved/Rejected result ── */}
            {(editTask.approvalStatus === "APPROVED" || editTask.approvalStatus === "REJECTED") && (
              <div className={cn(
                "rounded-lg border p-3 space-y-1.5",
                editTask.approvalStatus === "APPROVED"
                  ? "border-success/30 bg-success/5"
                  : "border-destructive/30 bg-destructive/5"
              )}>
                <p className={cn(
                  "text-caption font-semibold uppercase tracking-wider flex items-center gap-1.5",
                  editTask.approvalStatus === "APPROVED" ? "text-success" : "text-destructive"
                )}>
                  {editTask.approvalStatus === "APPROVED"
                    ? <><ThumbsUp className="h-3 w-3" />Abgenommen</>
                    : <><ThumbsDown className="h-3 w-3" />Abgelehnt</>
                  }
                </p>
                {editTask.approvalComment && (
                  <p className="text-sm whitespace-pre-wrap">{editTask.approvalComment}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Admin/Member edit form */}
        {(isCreateMode || isEditMode) && detailTab === "details" && (
          <form onSubmit={saveTask} className="space-y-4">
            <div className="space-y-2">
              <Label>Epic</Label>
              <Select value={formEpicId} onValueChange={setFormEpicId}>
                <SelectTrigger><SelectValue placeholder="Kein Epic" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Epic</SelectItem>
                  {epics.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />{e.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input id="title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
            </div>
            {editTask && (
              <ChecklistSection
                taskId={editTask.id}
                canEdit={!isClient}
                canToggle={!isClient || canClientInteract}
                onCountsChange={(total, done) => {
                  // Pure local state update — no PATCH needed, these counts
                  // are derived from checklist endpoints on next refetch anyway.
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === editTask.id
                        ? {
                            ...t,
                            _count: {
                              ...(t._count || {}),
                              checklistItems: total,
                              checklistDone: done,
                            },
                          }
                        : t
                    )
                  );
                }}
              />
            )}
            {/* Subtasks — only for top-level tasks (subtasks can't have subtasks) */}
            {editTask && !editTask.parentId && !isClient && (
              <SubtasksSection
                parentTask={editTask}
                projectId={projectId}
                statuses={statuses}
                onOpenSubtask={(sub) => openTaskDialog(sub)}
                onCountsChange={(total, done) => {
                  setTasks((prev) =>
                    prev.map((t) =>
                      t.id === editTask.id
                        ? {
                            ...t,
                            _count: {
                              ...(t._count || {}),
                              subtasks: total,
                              subtasksDone: done,
                            },
                          }
                        : t,
                    ),
                  );
                }}
              />
            )}
            {/* Inline subtask titles during creation */}
            {!editTask && !isClient && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Subtasks
                  <button
                    type="button"
                    onClick={() => setFormSubtaskTitles((p) => [...p, ""])}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" />Hinzufügen
                  </button>
                </Label>
                {formSubtaskTitles.map((st, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    <Input
                      value={st}
                      onChange={(e) => {
                        const next = [...formSubtaskTitles];
                        next[idx] = e.target.value;
                        setFormSubtaskTitles(next);
                      }}
                      placeholder="Subtask-Titel…"
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setFormSubtaskTitles((p) => [...p, ""]);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormSubtaskTitles((p) => p.filter((_, i) => i !== idx))}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorität</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getPriorityHex(formPriority) }} />
                      {PRIORITY_LABELS[formPriority]}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getPriorityHex(p) }} />
                          <span className="text-sm">{PRIORITY_LABELS[p]}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <DatePicker value={formStartDate} onChange={setFormStartDate} placeholder="Kein Datum" />
              </div>
              <div className="space-y-2">
                <Label>Fällig am</Label>
                <DatePicker value={formDueDate} onChange={setFormDueDate} placeholder="Kein Datum" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Wiederholung</Label>
                <RecurrencePicker value={formRecurrence} onChange={setFormRecurrence} />
              </div>
              <div className="space-y-2">
                <Label>Zugewiesen an</Label>
                <Select
                  value={formAssigneeId}
                  onValueChange={(v) => {
                    setFormAssigneeId(v);
                    const m = members.find((mem) => mem.id === v);
                    if (m?.role === "CLIENT") setFormClientVisible(true);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Niemand</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          {m.name || m.email}
                          {m.role === "CLIENT" && (
                            <span className="text-meta text-muted-foreground">(Kunde)</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Hint when a client is selected */}
                {(() => {
                  const assignee = members.find((m) => m.id === formAssigneeId);
                  return assignee?.role === "CLIENT" ? (
                    <p className="flex items-center gap-1.5 text-xs text-warning">
                      <ClipboardCheck className="h-3 w-3 shrink-0" />
                      Speichern startet die Kunden-Abnahme
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="clientVisible">Für Kunden sichtbar</Label>
              <Switch id="clientVisible" checked={formClientVisible}
                onCheckedChange={setFormClientVisible} />
            </div>
            {editTask && (
              <div className="border-t mt-4 pt-5">
                <TimeEntriesSection
                  taskId={editTask.id}
                  onUpdate={fetchTasks}
                  isClient={isClient}
                  isTimerActive={activeTimer?.taskId === editTask.id}
                  timerElapsed={activeTimer?.taskId === editTask.id ? elapsed : 0}
                  onTimerStart={handleTimerStart}
                  onTimerStop={handleTimerStop}
                />
              </div>
            )}

            {/* Approval status panel visible to staff */}
            {editTask?.approvalStatus && (
              <div className={cn(
                "rounded-lg border p-3 space-y-2",
                editTask.approvalStatus === "PENDING" && "border-warning/30 bg-warning/5",
                editTask.approvalStatus === "APPROVED" && "border-success/30 bg-success/5",
                editTask.approvalStatus === "REJECTED" && "border-destructive/30 bg-destructive/5"
              )}>
                <p className="text-caption font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                  <ClipboardCheck className="h-3 w-3" />Abnahme-Status
                </p>
                <ApprovalBadge status={editTask.approvalStatus as string} />
                {editTask.handoffComment && (
                  <div>
                    <p className="text-meta text-muted-foreground mb-0.5">Übergabe-Nachricht</p>
                    <p className="text-xs whitespace-pre-wrap">{editTask.handoffComment}</p>
                  </div>
                )}
                {editTask.approvalComment && (
                  <div>
                    <p className="text-meta text-muted-foreground mb-0.5">Kunden-Kommentar</p>
                    <p className="text-xs whitespace-pre-wrap">{editTask.approvalComment}</p>
                  </div>
                )}
                {/* Team can resubmit after a rejection */}
                {editTask.approvalStatus === "REJECTED" && (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      placeholder="Kurze Notiz zu den Änderungen (optional)"
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={resubmitApproval}
                      disabled={approvalSubmitting}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Erneut zur Abnahme einreichen
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Verknüpfungen sind vorübergehend ausgeblendet */}
            <DialogFooter>
              {editTask && <Button type="button" variant="destructive" onClick={() => deleteTask(editTask.id)}>Löschen</Button>}
              <Button type="submit" disabled={formSubmitting || !formTitle.trim()}>{editTask ? "Speichern" : "Erstellen"}</Button>
            </DialogFooter>
          </form>
        )}

        {editTask && detailTab === "comments" && (
          <CommentsSection taskId={editTask.id} members={members} currentUserId={currentUserId} />
        )}
        {editTask && detailTab === "files" && (
          <FilesSection taskId={editTask.id} isClient={isClient} canUpload={!isClient || canClientInteract} />
        )}
        {editTask && detailTab === "activity" && (
          <ActivityTimeline taskId={editTask.id} statuses={statuses} members={members} />
        )}
      </DialogContent>
    </Dialog>
  );
}
