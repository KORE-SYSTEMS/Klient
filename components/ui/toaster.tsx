"use client";

import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

function VariantIcon({ variant }: { variant?: string }) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />;
    case "info":
      return <Info className="h-4 w-4 shrink-0 text-info" />;
    case "destructive":
      return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
    default:
      return null;
  }
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const icon = <VariantIcon variant={props.variant as string | undefined} />;
        return (
          <Toast key={id} {...props}>
            {/* Icon column */}
            {icon && (
              <div className="mt-0.5 shrink-0">{icon}</div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>

            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
