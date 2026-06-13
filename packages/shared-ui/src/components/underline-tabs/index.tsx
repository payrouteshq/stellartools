"use client";

import * as React from "react";

import { cn } from "../../lib/utils";
import { TabsContent, TabsList, Tabs as TabsPrimitive, TabsTrigger } from "../../ui/tabs";

export const UnderlineTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentProps<typeof TabsList>
>(({ className, ...props }, ref) => {
  return (
    <TabsList
      ref={ref}
      className={cn("border-border h-auto gap-0 rounded-none border-b bg-transparent p-0", className)}
      {...props}
    />
  );
});
UnderlineTabsList.displayName = "UnderlineTabsList";

export const UnderlineTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentProps<typeof TabsTrigger>
>(({ className, ...props }, ref) => {
  return (
    <TabsTrigger
      ref={ref}
      className={cn(
        "text-muted-foreground rounded-none border-0 bg-transparent px-4 py-2",
        "data-[state=active]:text-primary data-[state=active]:bg-transparent",
        "data-[state=active]:border-primary data-[state=active]:border-b-2",
        "relative data-[state=active]:shadow-none",
        "hover:text-foreground transition-colors",
        className
      )}
      {...props}
    />
  );
});
UnderlineTabsTrigger.displayName = "UnderlineTabsTrigger";

export const UnderlineTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsContent>,
  React.ComponentProps<typeof TabsContent>
>(({ className, ...props }, ref) => {
  return <TabsContent ref={ref} className={className} {...props} />;
});
UnderlineTabsContent.displayName = "UnderlineTabsContent";

interface UnderlineTabsProps extends React.ComponentProps<typeof TabsPrimitive> {}

export const UnderlineTabs = ({ children, className, ...rest }: UnderlineTabsProps) => {
  return (
    <TabsPrimitive {...rest} className={cn("w-full", className)}>
      {children}
    </TabsPrimitive>
  );
};
