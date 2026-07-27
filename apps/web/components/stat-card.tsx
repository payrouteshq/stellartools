"use client";

import * as React from "react";

import { ShareWidget } from "@/components/share-widget";
import { type NormalizedChartPoint } from "@/lib/utils";
import { AppModal, Card, CardContent, LineChart, cn } from "@stellartools/shared-ui";
import { ArrowUpRight, Info } from "lucide-react";
import Link from "next/link";

export type SparkPoint = NormalizedChartPoint;

const SPARKLINE_CONFIG = {
  value: { label: "", color: "hsl(var(--chart-1))" },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  sparkData,
  color,
  href,
  tooltipValueFormatter,
  interactive = true,
  compact = false,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  sparkData: SparkPoint[];
  color: string;
  usage?: number;
  max?: number;
  href?: string;
  tooltipValueFormatter?: (value: number) => string;
  /** Set false to render a static, non-interactive preview (no share button, no link). */
  interactive?: boolean;
  /** Shrinks padding, type scale, and chart height to ~0.75x for dense/preview contexts. */
  compact?: boolean;
}) {
  const hasSpark = sparkData.length > 0;
  const chartData = hasSpark ? sparkData : Array.from({ length: 7 }, (_, i) => ({ i: `d${i}`, value: 0 }));

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    AppModal.open({
      title: `Share ${title}`,
      content: <ShareWidget title={title} value={value} subtitle={subtitle} sparkData={sparkData} />,
      size: "medium",
      showCloseButton: true,
    });
  };

  const card = (
    <Card
      className={cn(
        "border-border/60 bg-card group relative overflow-hidden shadow-xs transition-shadow",
        compact ? "rounded-xl py-0" : "rounded-2xl",
        href && interactive && "cursor-pointer hover:shadow-sm"
      )}
    >
      {interactive && (
        <button
          onClick={handleShare}
          title={`Share ${title}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 z-10 flex size-6 cursor-pointer items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100"
        >
          <ArrowUpRight className="size-3.5" />
        </button>
      )}

      <CardContent className={cn("flex flex-col", compact ? "gap-3 p-4 lg:gap-4 lg:p-5" : "gap-5 p-6")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className={cn(
                "text-muted-foreground font-medium tracking-wider uppercase",
                compact ? "text-[10px]" : "text-xs"
              )}
            >
              {title}
            </p>
            <div className="flex items-center gap-3">
              <p
                className={cn(
                  "text-foreground font-bold tracking-tight tabular-nums",
                  compact ? "text-lg lg:text-xl" : "text-2xl sm:text-3xl"
                )}
              >
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="text-muted-foreground/50 size-3 shrink-0" aria-hidden />
              <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>{subtitle}</p>
            </div>
          </div>
          <div
            className={cn(
              "bg-muted/80 flex shrink-0 items-center justify-center rounded-xl",
              compact ? "size-7 lg:size-8 [&>svg]:size-3.5 lg:[&>svg]:size-4" : "size-10 [&>svg]:size-5"
            )}
            style={{ color }}
          >
            {icon}
          </div>
        </div>

        <div
          className={cn(
            "relative mt-1 overflow-hidden",
            compact ? "-mx-4 h-16 rounded-b-lg lg:-mx-5 lg:h-20" : "-mx-6 h-28 rounded-b-2xl"
          )}
        >
          <LineChart
            data={chartData}
            config={SPARKLINE_CONFIG}
            xAxisKey="i"
            activeKey="value"
            color={color as "var(--chart-1)"}
            className="h-full w-full"
            showXAxis={false}
            showTooltip={interactive}
            showGrid={false}
            tooltipFormatter={
              tooltipValueFormatter ? (value: unknown) => tooltipValueFormatter(Number(value)) : undefined
            }
          />
        </div>
      </CardContent>
    </Card>
  );

  if (href && interactive) {
    return (
      <Link
        href={href}
        className="focus-visible:ring-ring block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {card}
      </Link>
    );
  }
  return card;
}
