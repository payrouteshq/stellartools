"use client";

import * as React from "react";

import { cn } from "../../lib/utils";

export interface FieldStackProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
}

export const FieldStack = ({ children, className, ...props }: FieldStackProps) => {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  );
};

export interface EmbeddedFieldRowProps extends React.ComponentProps<"div"> {
  when: boolean;
  children: React.ReactNode;
  layout?: "inline" | "stack";
}

const EmbeddedFieldRowRoot = ({ when, children, layout = "inline", className, ...props }: EmbeddedFieldRowProps) => {
  if (!when) return null;

  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-top-1 relative ml-3 pl-5",
        layout === "inline" ? "flex items-center gap-2" : "flex flex-col gap-2",
        className
      )}
      {...props}
    >
      <div className="border-border absolute top-[-12px] left-0 h-[calc(50%+12px)] w-4 rounded-bl border-b border-l" />
      {children}
    </div>
  );
};

const EmbeddedFieldRowLabel = ({ children, className, ...props }: React.ComponentProps<"span">) => {
  return (
    <span className={cn("text-muted-foreground shrink-0 text-sm font-medium", className)} {...props}>
      {children}
    </span>
  );
};

const EmbeddedFieldRowSuffix = ({ children, className, ...props }: React.ComponentProps<"span">) => {
  return (
    <span className={cn("text-muted-foreground text-sm", className)} {...props}>
      {children}
    </span>
  );
};

export const EmbeddedFieldRow = Object.assign(EmbeddedFieldRowRoot, {
  Label: EmbeddedFieldRowLabel,
  Suffix: EmbeddedFieldRowSuffix,
});
