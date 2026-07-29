"use client";

import React, { useCallback, useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";

import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";

type ModalButtonProps = React.ComponentProps<typeof Button> & {
  children: React.ReactNode;
};

export interface AppModalOptions {
  title: string;
  description?: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
  primaryButton?: ModalButtonProps;
  secondaryButton?: ModalButtonProps;
  size?: "small" | "medium" | "full";
  showCloseButton?: boolean;
  onClose?: () => void;
}

type SetModalState = React.Dispatch<React.SetStateAction<{ open: boolean; config: AppModalOptions | null }>>;

let setGlobalState: SetModalState | null = null;

export const AppModal = {
  open: (options: AppModalOptions) => setGlobalState?.({ open: true, config: options }),
  close: () => setGlobalState?.((prev) => ({ ...prev, open: false, config: null })),
  updateConfig: (partial: Partial<AppModalOptions>) =>
    setGlobalState?.((prev) => (prev.config ? { ...prev, config: { ...prev.config, ...partial } } : prev)),
};

interface AppModalProps extends AppModalOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AppModalUI = ({
  open,
  onOpenChange,
  title,
  description,
  content,
  footer,
  size = "full",
  showCloseButton = true,
}: AppModalProps) => {
  const sizeStyles = {
    small: "max-h-[90vh] sm:max-w-md flex flex-col",
    medium: "max-h-[90vh] sm:max-w-2xl flex flex-col",
    full: "inset-0! top-0! left-0! right-0! bottom-0! translate-x-0! translate-y-0! m-0! h-screen! w-screen! max-w-none! sm:max-w-none! rounded-none",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogContent
            showCloseButton={showCloseButton}
            className={cn("gap-0 overflow-visible border-none bg-transparent p-0 shadow-none", sizeStyles[size])}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "bg-background flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-lg",
                size === "full" && "h-full min-h-screen w-full rounded-none",
                size !== "full" && "h-auto max-h-[90vh] w-full"
              )}
            >
              <DialogHeader className="shrink-0 border-b px-6 py-6 sm:py-8">
                <DialogTitle className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</DialogTitle>
                {description && <DialogDescription className="text-base">{description}</DialogDescription>}
              </DialogHeader>

              {content && (
                <div
                  className={cn(
                    "min-h-0 min-w-0 px-6 py-6",
                    size === "full" && "flex flex-1 flex-col overflow-y-auto",
                    size !== "full" && "flex-1 overflow-auto"
                  )}
                >
                  {content}
                </div>
              )}

              {footer && <DialogFooter className="bg-muted/30 shrink-0 border-t px-6 py-4">{footer}</DialogFooter>}
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
};

export function AppModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; config: AppModalOptions | null }>({
    open: false,
    config: null,
  });

  useEffect(() => {
    setGlobalState = setState;
    return () => {
      setGlobalState = null as any;
    };
  }, []);

  const close = useCallback(() => {
    setState((prev) => {
      prev.config?.onClose?.();
      return { open: false, config: null };
    });
  }, []);

  const generatedFooter =
    state.config?.footer ||
    ((state.config?.primaryButton || state.config?.secondaryButton) && (
      <div className="flex w-full justify-end gap-3">
        {state.config.secondaryButton && (
          <Button
            variant="outline"
            size="sm"
            {...state.config.secondaryButton}
            onClick={(e) => {
              state.config?.secondaryButton?.onClick?.(e);
              close();
            }}
          />
        )}
        {state.config.primaryButton && (
          <Button
            size="sm"
            {...state.config.primaryButton}
            onClick={(e) => {
              state.config?.primaryButton?.onClick?.(e);
              close();
            }}
          />
        )}
      </div>
    ));

  return (
    <>
      {children}
      {state.config && (
        <AppModalUI
          {...state.config}
          open={state.open}
          onOpenChange={(open) => !open && close()}
          footer={generatedFooter}
        />
      )}
    </>
  );
}
