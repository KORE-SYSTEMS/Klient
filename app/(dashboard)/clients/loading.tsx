import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

function ClientCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        {/* Avatar */}
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-8 w-8 rounded-sm" />
      </CardContent>
    </Card>
  );
}

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-36 rounded-sm" />
      </div>

      {/* Client cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ClientCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
