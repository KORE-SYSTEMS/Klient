import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-sm" />
          <Skeleton className="h-8 w-24 rounded-sm" />
        </div>
        <Skeleton className="h-8 w-28 rounded-sm" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex-shrink-0 w-[272px] space-y-2">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <Skeleton className="h-6 w-6 rounded-sm" />
            </div>

            {/* Task cards */}
            <div className="space-y-2">
              {Array.from({ length: col === 0 ? 4 : col === 1 ? 3 : col === 2 ? 5 : 2 }).map((_, i) => (
                <div key={i} className="rounded-sm border bg-card p-3 space-y-2.5">
                  {/* Task title */}
                  <Skeleton className="h-4 w-full" />
                  {i % 3 === 0 && <Skeleton className="h-3 w-3/4" />}

                  {/* Tags */}
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    {i % 2 === 0 && <Skeleton className="h-4 w-16 rounded-full" />}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-3 w-6" />
                    </div>
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
