"use client";

import { create } from "zustand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. Defaults to true — most confirmations are deletions. */
  destructive?: boolean;
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({ options: null, resolve: null }));

/**
 * Promise-based replacement for window.confirm():
 *
 *     if (!(await confirmDialog({ title: "Rechnung löschen?" }))) return;
 *
 * Requires <ConfirmHost /> to be mounted once (root layout).
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Settle a still-open dialog as "cancelled" before showing the next one
  useConfirmStore.getState().resolve?.(false);
  return new Promise<boolean>((resolve) => {
    useConfirmStore.setState({ options, resolve });
  });
}

function settle(ok: boolean) {
  const { resolve } = useConfirmStore.getState();
  useConfirmStore.setState({ options: null, resolve: null });
  resolve?.(ok);
}

export function ConfirmHost() {
  const options = useConfirmStore((s) => s.options);

  return (
    <Dialog open={!!options} onOpenChange={(open) => { if (!open) settle(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          {options?.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Abbrechen"}
          </Button>
          <Button
            variant={options?.destructive === false ? "default" : "destructive"}
            onClick={() => settle(true)}
            autoFocus
          >
            {options?.confirmLabel ?? "Löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
