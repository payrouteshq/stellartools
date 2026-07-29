"use client";

import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";
import hotToast, { Toaster as HotToaster } from "react-hot-toast";

import { cn } from "../lib/utils";

type ToasterProps = React.ComponentProps<typeof HotToaster>;

const toastBaseClass =
  "bg-card! text-card-foreground! border! border-border! shadow-none! rounded-lg! px-4! py-3! min-h-14! max-w-md! backdrop-blur-sm!";

const Toaster = (props: ToasterProps) => (
  <HotToaster
    gutter={8}
    {...props}
    toastOptions={{
      className: toastBaseClass,
      duration: 4000,
      position: "top-center",
      ...props.toastOptions,
    }}
  />
);

function renderCustom(message: string, icon: React.ReactNode, className?: string) {
  return hotToast.custom(
    (t) => (
      <div
        className={cn(
          "bg-card text-card-foreground border-border flex min-h-14 w-full max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-none backdrop-blur-sm transition-opacity",
          t.visible ? "opacity-100" : "opacity-0",
          className
        )}
      >
        {icon}
        <span className="text-sm leading-relaxed">{message}</span>
      </div>
    ),
    { duration: 4000 }
  );
}

export const toast = {
  success: (message: string) =>
    hotToast.success(message, {
      icon: <CircleCheck className="text-primary size-5 shrink-0" />,
    }),

  error: (message: string) =>
    hotToast.error(message, {
      icon: <CircleX className="text-destructive size-5 shrink-0" />,
    }),

  info: (message: string) => renderCustom(message, <Info className="text-primary size-5 shrink-0" />),

  warning: (message: string) => renderCustom(message, <CircleAlert className="size-5 shrink-0 text-orange-500" />),

  message: (message: string) => hotToast(message),

  promise: <T,>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) =>
    hotToast.promise(promise, {
      loading: options.loading,
      success: options.success,
      error: options.error,
    }),
};

export { Toaster };
