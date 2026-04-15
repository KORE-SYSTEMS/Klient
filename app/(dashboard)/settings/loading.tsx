import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-60" />
      </div>

      {/* Version card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Workspace card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-32 rounded-sm" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32 rounded-sm" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-64 rounded-sm" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-sm" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMTP card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-sm" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-9 w-28 rounded-sm" />
    </div>
  );
}
