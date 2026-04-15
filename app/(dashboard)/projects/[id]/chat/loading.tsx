import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-280px)]">
      {/* Message area */}
      <div className="flex-1 space-y-4 overflow-hidden">
        {/* Incoming */}
        <div className="flex items-start gap-3">
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 max-w-xs">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-16 w-60 rounded-sm" />
          </div>
        </div>
        {/* Outgoing */}
        <div className="flex items-start gap-3 flex-row-reverse">
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 max-w-xs">
            <Skeleton className="h-3 w-16 ml-auto" />
            <Skeleton className="h-10 w-48 rounded-sm" />
          </div>
        </div>
        {/* Incoming */}
        <div className="flex items-start gap-3">
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 max-w-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-24 w-72 rounded-sm" />
          </div>
        </div>
        {/* Outgoing */}
        <div className="flex items-start gap-3 flex-row-reverse">
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 max-w-xs">
            <Skeleton className="h-3 w-16 ml-auto" />
            <Skeleton className="h-12 w-56 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 border-t pt-4">
        <Skeleton className="flex-1 h-10 rounded-sm" />
        <Skeleton className="h-10 w-10 rounded-sm" />
      </div>
    </div>
  );
}
