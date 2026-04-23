"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Wraps any input/select/textarea with a ❓ icon on the right that shows
 * a custom tooltip on hover. The child element should have `pr-8` so text
 * doesn't overlap the icon.
 *
 * Usage:
 *   <FieldHint hint="Wird als Zahlungsinformation angezeigt.">
 *     <Input ... className="pr-8" />
 *   </FieldHint>
 */
export function FieldHint({
  hint,
  children,
  className,
  side = "top",
}: {
  hint: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Hinweis"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-muted-foreground focus:outline-none"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side}>{hint}</TooltipContent>
      </Tooltip>
    </div>
  );
}
