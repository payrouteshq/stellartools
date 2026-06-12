"use client";

import * as React from "react";

import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "../lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const updateIndicator = () => {
      const activeTrigger = list.querySelector<HTMLElement>('[data-state="active"]');
      if (activeTrigger) {
        const listRect = list.getBoundingClientRect();
        const triggerRect = activeTrigger.getBoundingClientRect();
        setIndicatorStyle({
          left: triggerRect.left - listRect.left,
          width: triggerRect.width,
        });
      }
    };

    updateIndicator();

    const observer = new MutationObserver(updateIndicator);
    observer.observe(list, {
      attributes: true,
      attributeFilter: ["data-state"],
      subtree: true,
    });

    // Update on resize
    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground relative inline-flex h-auto w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    >
      <span
        className="bg-background dark:bg-input/30 dark:border-input absolute top-[3px] h-[calc(100%-6px)] rounded-md transition-all duration-300 ease-out dark:border"
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
        }}
        aria-hidden="true"
      />
      {props.children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground dark:text-muted-foreground relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
