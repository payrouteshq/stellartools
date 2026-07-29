"use client";

import React from "react";

import { Area, CartesianGrid, AreaChart as RechartsAreaChart, XAxis } from "recharts";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../ui/chart";

export type BaseChartData = Record<string, string | number>;

export type ChartColor = "var(--chart-1)" | "var(--chart-2)" | "var(--chart-3)" | "var(--chart-4)" | "var(--chart-5)";

interface AreaChartProps<T extends BaseChartData>
  extends
    Omit<React.ComponentProps<typeof ChartContainer>, "children">,
    MixinProps<"xAxis", Omit<React.ComponentProps<typeof XAxis>, "dataKey" | "key" | "ref">>,
    MixinProps<
      "tooltip",
      Omit<React.ComponentProps<typeof ChartTooltipContent>, "nameKey" | "labelFormatter" | "key" | "ref">
    >,
    MixinProps<"area", Omit<React.ComponentProps<typeof Area>, "dataKey" | "key" | "ref">>,
    MixinProps<"grid", React.ComponentProps<typeof CartesianGrid>> {
  data: T[];
  config: ChartConfig;
  xAxisKey: Extract<keyof T, string>;
  activeKey: Extract<keyof T, string>;
  color: ChartColor;
  xAxisFormatter?: (value: string | number) => string;
  tooltipLabelFormatter?: (value: string | number) => string;
  className?: string;
  showTooltip?: boolean;
  showXAxis?: boolean;
}

export function AreaChart<T extends BaseChartData>({
  data,
  config,
  xAxisKey,
  activeKey,
  color,
  xAxisFormatter,
  tooltipLabelFormatter,
  className,
  showTooltip = true,
  showXAxis = true,
  ...mixinProps
}: AreaChartProps<T>) {
  const defaultFormatter = (value: string | number) => {
    const date = new Date(value);

    return !isNaN(date.getTime())
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : String(value);
  };

  const formatX = xAxisFormatter || defaultFormatter;
  const formatTooltip = tooltipLabelFormatter || defaultFormatter;

  const { xAxis, tooltip, area, rest, grid } = splitProps(mixinProps, "xAxis", "tooltip", "area", "grid");

  const chartLabel =
    typeof rest["aria-label"] === "string"
      ? rest["aria-label"]
      : config[activeKey]?.label != null
        ? String(config[activeKey].label)
        : "Area chart";

  return (
    <ChartContainer
      {...rest}
      config={config}
      role="img"
      aria-label={rest["aria-label"] ?? chartLabel}
      className={cn("aspect-auto h-62.5 w-full", className)}
    >
      <RechartsAreaChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} {...grid} />

        {showXAxis && (
          <XAxis
            {...xAxis}
            dataKey={xAxisKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={formatX}
          />
        )}

        {showTooltip && (
          <ChartTooltip
            content={
              <ChartTooltipContent
                {...tooltip}
                className={cn(
                  "border-muted/40 w-fit min-w-30 gap-1 px-2 py-1.5 text-[11px] shadow-lg backdrop-blur-sm",
                  tooltip.className
                )}
                labelClassName="font-medium text-muted-foreground/80 mb-0.5"
                nameKey={activeKey}
                labelFormatter={formatTooltip}
              />
            }
          />
        )}

        <Area
          type="monotone"
          stroke={color}
          fill={color}
          fillOpacity={0.2} // Default opacity, overridable via areaFillOpacity
          strokeWidth={2}
          {...area}
          dataKey={activeKey}
        />
      </RechartsAreaChart>
    </ChartContainer>
  );
}

/**
 * USAGE EXAMPLE
 *
 * const chartConfig = {
 *   revenue: {
 *     label: "Revenue",
 *     color: "hsl(var(--chart-1))",
 *   },
 * };
 *
 * <AreaChart
 *   data={data}
 *   config={chartConfig}
 *   xAxisKey="date"
 *   activeKey="revenue"
 *   color="var(--chart-1)"
 *   // Customization via Mixins
 *   areaType="step"
 *   areaFillOpacity={0.4}
 *   gridVertical={true}
 * />
 */
