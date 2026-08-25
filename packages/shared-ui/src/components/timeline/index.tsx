"use client";

import * as React from "react";

import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";

type LinkComponentType = React.ComponentType<{
  href: string;
  className?: string;
  target?: string;
  rel?: string;
  children?: React.ReactNode;
}>;

const DefaultLink: LinkComponentType = ({ href, children, ...props }) => (
  <a href={href} {...props}>
    {children}
  </a>
);

export interface TimelineEntry {
  title: React.ReactNode;
  date: React.ReactNode;
  data?: Record<string, any> | null;
  contentOverride?: React.ReactNode;
  key?: string | number;
  titleClassName?: string;
}

export interface TimelineProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => TimelineEntry;
  className?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  limit?: number;
  skeletonRowCount?: number;
  routeMap?: Record<string, (id: string) => string>;
  linkComponent?: LinkComponentType;
}

// --- Internal Helpers ---

const formatLabel = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^[a-z]/, (m) => m.toUpperCase());

function TimelineSummary({
  data,
  manualContent,
  routeMap,
  LinkComponent,
}: {
  data?: any;
  manualContent?: React.ReactNode;
  routeMap?: Record<string, (id: string) => string>;
  LinkComponent: LinkComponentType;
}) {
  const summaryItems = React.useMemo(
    () =>
      Object.entries(data)
        .filter(([key, val]) => key !== "$changes" && val !== null && typeof val !== "object")
        .map(([key, val]) => {
          const href = routeMap?.[key]?.(String(val));

          const strVal = String(val);
          const displayVal =
            href && strVal.startsWith("http")
              ? strVal.replace(/^https?:\/\//, "").replace(/^([\w.-]+\/[\w.-]+\/[\w.-]+\/).*(\w{6})$/, "$1…$2")
              : strVal;

          return (
            <span key={key} className="inline-flex items-center">
              <span className="text-muted-foreground mr-1 font-medium">{formatLabel(key)}:</span>
              {href ? (
                <LinkComponent
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  href={href}
                  className="text-primary font-mono text-[13px] underline"
                >
                  {displayVal}
                </LinkComponent>
              ) : (
                <span className="text-foreground/80">{String(val)}</span>
              )}
            </span>
          );
        }),
    [data, routeMap, LinkComponent]
  );

  if (manualContent) return <div className="text-foreground/90 text-sm">{manualContent}</div>;

  if (!data) return null;

  if (summaryItems.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-relaxed">
      {summaryItems.reduce(
        (prev, curr, i) =>
          i === 0
            ? [curr]
            : [
                ...prev,
                <span key={`sep-${i}`} className="text-muted-foreground/30">
                  •
                </span>,
                curr,
              ],
        [] as React.ReactNode[]
      )}
    </div>
  );
}

function TimelineDiff({ changes }: { changes: any }) {
  if (!changes) return null;

  const previous = changes.previous_attributes ?? {};
  const current = changes.data ?? {};
  const keys = Object.keys(previous);

  if (keys.length === 0) return null;

  return (
    <div className="border-muted mt-2 space-y-1.5 border-l-2 py-0.5 pl-3">
      {keys.map((key) => {
        const from = previous[key] ?? null;
        const to = current[key] ?? null;

        return (
          <div key={key} className="text-[12px] leading-tight">
            <span className="text-foreground/80 font-medium">{formatLabel(key)}: </span>
            <span className="text-muted-foreground/60 decoration-muted-foreground/40 italic line-through">
              {from === null || from === "" ? "none" : String(from)}
            </span>
            <span className="text-muted-foreground/40 mx-1.5">→</span>
            <span className="text-primary font-medium">
              {to === null || to === "" ? "none" : typeof to === "object" ? JSON.stringify(to) : String(to)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Component ---

export function Timeline<T>({
  items,
  renderItem,
  isLoading,
  limit = 0,
  className,
  emptyMessage = "No story found",
  skeletonRowCount = 3,
  routeMap,
  linkComponent: LinkComponent = DefaultLink,
}: TimelineProps<T>) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (isLoading) {
    return (
      <div className={cn("relative flex flex-col", className)}>
        <ul className="relative m-0 list-none p-0">
          <div
            className="bg-border absolute top-2 left-1.75 w-px"
            style={{ height: "calc(100% - 20px)" }}
            aria-hidden="true"
          />
          {Array.from({ length: skeletonRowCount }).map((_, i) => (
            <li key={i} className="relative pb-8 pl-7 last:pb-0">
              <div className="bg-muted ring-background absolute top-1.5 left-0 z-10 size-3 rounded-full ring-4" />
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-1 h-3 w-20 sm:mt-0" />
                </div>
                <div className="mt-1.5 space-y-1">
                  <Skeleton className="h-3 w-full max-w-md" />
                  <Skeleton className="h-3 w-3/4 max-w-xs" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className={cn("text-muted-foreground py-10 text-center text-sm italic", className)}>{emptyMessage}</div>
    );
  }

  const displayItems = limit > 0 && items.length > limit && !isExpanded ? items.slice(0, limit) : items;

  return (
    <div className={cn("relative flex flex-col", className)}>
      <ul className="relative m-0 list-none p-0">
        <div
          className="bg-border absolute top-2 left-1.75 w-px"
          style={{ height: "calc(100% - 20px)" }}
          aria-hidden="true"
        />

        {displayItems.map((item, index) => {
          const entry = renderItem(item, index);
          if (entry.data?.$changes && Object.keys(entry.data?.$changes ?? {}).length < 1) return null;
          return (
            <li key={entry.key ?? index} className="group relative pb-8 pl-7 last:pb-0">
              <div className="bg-primary ring-background absolute top-1.5 left-0 z-10 size-3 rounded-full ring-4 transition-transform group-hover:scale-110" />

              <div className="flex flex-col gap-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <h4
                    className={cn(
                      "text-muted-foreground text-[10px] font-bold tracking-widest uppercase",
                      entry.titleClassName
                    )}
                  >
                    {entry.title}
                  </h4>
                  <time className="text-muted-foreground/60 text-[10px] font-medium sm:mt-0">{entry.date}</time>
                </div>

                <TimelineSummary
                  data={entry.data}
                  manualContent={entry.contentOverride}
                  routeMap={routeMap}
                  LinkComponent={LinkComponent}
                />
                <TimelineDiff changes={entry.data?.$changes} />
              </div>
            </li>
          );
        })}

        {limit > 0 && items.length > limit && !isExpanded && (
          <div className="from-background via-background/90 pointer-events-none absolute inset-x-0 bottom-0 flex h-32 items-end justify-center bg-linear-to-t to-transparent pb-1">
            <Button
              variant="secondary"
              size="sm"
              className="pointer-events-auto h-8 rounded-full border shadow-sm"
              onClick={() => setIsExpanded(true)}
            >
              <ChevronDown className="mr-2 size-3" /> Show {items.length - limit} more
            </Button>
          </div>
        )}
      </ul>

      {isExpanded && (
        <Button
          variant="secondary"
          size="sm"
          className="pointer-events-auto mx-auto mt-2 h-8 w-fit rounded-full border shadow-sm"
          onClick={() => setIsExpanded(false)}
        >
          <ChevronUp className="mr-2 size-3" /> Show less
        </Button>
      )}
    </div>
  );
}
