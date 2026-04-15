import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function UpdatesLoading() {
  return (
    <div className="space-y-4">
      {/* Post box */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-20 w-full rounded-sm" />
          <div className="flex justify-end">
            <Skeleton className="h-8 w-28 rounded-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Update entries */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
