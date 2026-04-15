import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Skeleton className="h-3 w-3 rounded-sm flex-shrink-0" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        {/* Description */}
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        {/* Meta row */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        {/* Avatars */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-6 rounded-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-36 rounded-sm" />
      </div>

      {/* Project cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
