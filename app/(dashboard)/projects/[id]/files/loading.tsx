import { Skeleton } from "@/components/ui/skeleton";

export default function FilesLoading() {
  return (
    <div className="space-y-4">
      {/* Drop zone skeleton */}
      <div className="rounded-sm border-2 border-dashed border-border p-8 flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* File rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-sm border p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-8 w-8 rounded-sm" />
              <Skeleton className="h-8 w-8 rounded-sm" />
              <Skeleton className="h-8 w-8 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
