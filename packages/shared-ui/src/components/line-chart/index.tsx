"use client";

import React, { useId } from "react";

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "../../ui/chart";
import { type BaseChartData, type ChartColor } from "../area-chart";

interface LineChartProps<T extends BaseChartData>
  extends
    Omit<React.ComponentProps<typeof ChartContainer>, "children">,
    MixinProps<"xAxis", Omit<React.ComponentProps<typeof XAxis>, "dataKey" | "key" | "ref">>,
    MixinProps<
      "tooltip",
      Omit<React.ComponentProps<typeof ChartTooltipContent>, "nameKey" | "labelFormatter" | "key" | "ref">
    >,
    MixinProps<"line", Omit<React.ComponentProps<typeof Line>, "dataKey" | "key" | "ref">>,
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
  showGrid?: boolean;
}

export function LineChart<T extends BaseChartData>({
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
  showGrid = true,
  ...mixinProps
}: LineChartProps<T>) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `lg-${uid}`;

  const defaultFormatter = (value: string | number) => {
    const date = new Date(value);

    return !isNaN(date.getTime())
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : String(value);
  };

  const formatX = xAxisFormatter || defaultFormatter;
  const formatTooltip = tooltipLabelFormatter || defaultFormatter;

  const { xAxis, tooltip, line, rest, grid } = splitProps(mixinProps, "xAxis", "tooltip", "line", "grid");

  return (
    <ChartContainer {...rest} config={config} className={cn("aspect-auto h-[250px] w-full", className)}>
      <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="75%" stopColor={color} stopOpacity={0.04} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <YAxis domain={[0, (max: number) => (max === 0 ? 10 : max * 1.15)]} hide />

        {showGrid && <CartesianGrid vertical={false} {...grid} />}

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
                  "border-muted/40 w-fit min-w-[120px] gap-1 px-2 py-1.5 text-[11px] shadow-lg backdrop-blur-sm",
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
          dataKey={activeKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
          {...(line as Omit<React.ComponentProps<typeof Area>, "dataKey" | "key" | "ref">)}
        />
      </AreaChart>
    </ChartContainer>
  );
}
