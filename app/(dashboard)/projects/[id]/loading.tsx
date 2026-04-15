import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Project header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="h-4 w-4 rounded-sm flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-sm" />
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 border-b pb-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-sm" />
        ))}
      </div>

      {/* Kanban board skeleton */}
      <div className="flex gap-4 pt-2 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex-shrink-0 w-64 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: col === 0 ? 3 : col === 1 ? 4 : 2 }).map((_, row) => (
                <div key={row} className="rounded-sm border bg-card p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
