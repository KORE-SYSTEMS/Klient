"use client";

import { useEffect, useState } from "react";
import { ArrowRight, History, Paperclip } from "lucide-react";
import { cn, getPriorityColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ACTIVITY_LABELS, PRIORITY_LABELS } from "@/lib/task-meta";
import type { ProjectMember, TaskActivity, TaskStatus } from "../_lib/types";

interface ActivityTimelineProps {
  taskId: string;
  statuses: TaskStatus[];
  members: ProjectMember[];
}

/** Reverse-chronological log of all changes on a task. */
export function ActivityTimeline({ taskId, statuses, members }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/activities`)
      .then((r) => r.json())
      .then((data) => {
        setActivities(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [taskId]);

  function getStatusName(id: string) {
    return statuses.find((s) => s.id === id)?.name || id;
  }
  function getUserName(id: string) {
    const m = members.find((m) => m.id === id);
    return m?.name || m?.email || id;
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-2">
            <div className="flex flex-col items-center">
              <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
            </div>
            <div className="flex-1 space-y-1.5 pb-2">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return <EmptyState icon={History} title="Keine Aktivitäten" compact />;
  }

  return (
    <div className="max-h-[300px] overflow-y-auto space-y-0">
      {activities.map((activity, i) => (
        <div key={activity.id} className="flex gap-3 py-2.5">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "h-2 w-2 rounded-full shrink-0 mt-1.5",
                activity.type === "CREATED" ? "bg-green-500" :
                activity.type === "STATUS_CHANGE" ? "bg-blue-500" :
                activity.type === "COMMENT" ? "bg-yellow-500" :
                activity.type === "FILE_UPLOAD" ? "bg-purple-500" :
                "bg-muted-foreground/50",
              )}
            />
            {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xs font-semibold">{activity.user.name || activity.user.email}</span>
              <span className="text-xs text-muted-foreground">
                {ACTIVITY_LABELS[activity.type] || activity.type}
              </span>
            </div>
            {activity.type === "STATUS_CHANGE" && activity.oldValue && activity.newValue && (
              <div className="flex items-center gap-1.5 mt-1 text-caption">
                <Badge variant="outline" className="text-meta px-1.5 py-0">
                  {getStatusName(activity.oldValue)}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-meta px-1.5 py-0">
                  {getStatusName(activity.newValue)}
                </Badge>
              </div>
            )}
            {activity.type === "PRIORITY_CHANGE" && activity.oldValue && activity.newValue && (
              <div className="flex items-center gap-1.5 mt-1 text-caption">
                <span className={cn("font-medium", getPriorityColor(activity.oldValue))}>
                  {PRIORITY_LABELS[activity.oldValue] || activity.oldValue}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className={cn("font-medium", getPriorityColor(activity.newValue))}>
                  {PRIORITY_LABELS[activity.newValue] || activity.newValue}
                </span>
              </div>
            )}
            {activity.type === "ASSIGNMENT" && (
              <div className="flex items-center gap-1.5 mt-1 text-caption">
                <span className="text-muted-foreground">
                  {activity.oldValue ? getUserName(activity.oldValue) : "Niemand"}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">
                  {activity.newValue ? getUserName(activity.newValue) : "Niemand"}
                </span>
              </div>
            )}
            {activity.type === "FILE_UPLOAD" && activity.newValue && (
              <div className="flex items-center gap-1 mt-1 text-caption text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                {activity.newValue}
              </div>
            )}
            {activity.type === "COMMENT" && activity.newValue && (
              <p className="text-caption text-muted-foreground mt-1 line-clamp-2">
                &ldquo;{activity.newValue}&rdquo;
              </p>
            )}
            <span className="text-meta text-muted-foreground mt-0.5 block">
              {new Date(activity.createdAt).toLocaleDateString("de-DE", {
                day: "2-digit", month: "2-digit", year: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
