"use client";

import React from "react";

import { retrieveOverviewStats } from "@/actions/organization";
import { AppModal } from "@/components/app-modal";
import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  AddUserIcon,
  CheckMark,
  DollarIcon,
  GroupedUsersIcon,
  HourglassIcon,
  LoopIcon,
  SubscriptionIcon,
} from "@/components/icon";
import { LineChart } from "@/components/line-chart";
import { SelectField } from "@/components/select-field";
import { ShareWidget } from "@/components/share-widget";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetRates } from "@/hooks/use-asset-rates";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useOrgQuery } from "@/hooks/use-org-query";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ChevronsUpDown, Info } from "lucide-react";
import Link from "next/link";

type CurrencyItem = { code: string; name: string; symbol: string };

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

function getCurrencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

function usdCentsToDisplay(
  usdCents: number,
  item: CurrencyItem | null,
  fiatRates: Record<string, number> | null
): string {
  if (!item || !fiatRates) return "—";
  const value = (usdCents / 100) * (fiatRates[item.code] ?? 1);
  return item.symbol + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SPARKLINE_CONFIG = {
  value: { label: "", color: "hsl(var(--chart-1))" },
};

export default function DashboardPage() {
  const [selectedCode, setSelectedCode] = useCookieState("dashboard_currency", "USD");
  const [countryOpen, setCountryOpen] = React.useState(false);
  const [period, setPeriod] = useCookieState("dashboard_period", "30");

  const since = React.useMemo(() => new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000), [period]);

  const { data: stats, isLoading: isStatsLoading } = useOrgQuery(
    ["overview-stats", period],
    () => retrieveOverviewStats({ since }),
    { staleTime: 60 * 1000 }
  );

  const { fiatRates, isLoading: isRatesLoading } = useAssetRates([{ code: "XLM", issuer: "native" }]);

  console.log({ isRatesLoading, fiatRates });

  const currencyItems = React.useMemo<CurrencyItem[]>(() => {
    if (!fiatRates) return [];
    return Object.keys(fiatRates)
      .map((code) => ({ code, name: currencyNames.of(code) ?? code, symbol: getCurrencySymbol(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fiatRates]);

  const selectedItem = currencyItems.find((c) => c.code === selectedCode) ?? null;

  if (isStatsLoading || !stats) {
    return (
      <div className="w-full">
        <DashboardSidebar>
          <DashboardSidebarInset>
            <StatCardsSkeleton />
          </DashboardSidebarInset>
        </DashboardSidebar>
      </div>
    );
  }

  const revenue28 = usdCentsToDisplay(stats.revenue, selectedItem, fiatRates);
  const mrrDisplay = usdCentsToDisplay(stats.mrr, selectedItem, fiatRates);

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-8 p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">Overview</h1>
              </div>
              <div className="flex items-center gap-2">
                <SelectField
                  id="period-select"
                  value={period}
                  onChange={setPeriod}
                  triggerClassName="h-9 w-[140px]"
                  items={[
                    { value: "7", label: "Last 7 days" },
                    { value: "30", label: "Last 30 days" },
                    { value: "365", label: "Last 365 days" },
                  ]}
                />
                <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                  <PopoverTrigger asChild>
                    {isRatesLoading ? (
                      <div className="flex h-9 w-max items-center justify-center">
                        <Spinner strokeColor="var(--muted-foreground)" size={30} />
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryOpen}
                        className="border-border/80 h-9 w-[200px] justify-between rounded-lg font-normal shadow-xs"
                      >
                        <span className="truncate">
                          {selectedItem ? `${selectedItem.name} (${selectedItem.code})` : "Select currency"}
                        </span>
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    )}
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="end" onWheel={(e) => e.stopPropagation()}>
                    <Command>
                      <CommandInput placeholder="Search currency..." />
                      <CommandList className="max-h-[280px]">
                        <CommandEmpty>No currency found.</CommandEmpty>
                        <CommandGroup>
                          {currencyItems.map((item) => (
                            <CommandItem
                              key={item.code}
                              value={`${item.name} ${item.code}`.toLowerCase()}
                              onSelect={() => {
                                setSelectedCode(item.code);
                                setCountryOpen(false);
                              }}
                            >
                              <span className={cn("flex-1 truncate", selectedCode === item.code && "font-medium")}>
                                {item.name} ({item.code})
                              </span>
                              {selectedCode === item.code && <CheckMark className="text-foreground size-4 shrink-0" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <StatCard
                title="Active Trials"
                value={stats.activeTrials}
                subtitle="In total"
                icon={<HourglassIcon className="text-muted-foreground size-5" />}
                sparkData={stats.charts.trials}
                color="var(--chart-1)"
                usage={stats.activeTrials}
              />
              <StatCard
                title="Active Subscriptions"
                value={stats.activeSubscriptions}
                subtitle="In total"
                icon={<SubscriptionIcon className="text-muted-foreground size-5" />}
                sparkData={stats.charts.subscriptions}
                color="var(--chart-2)"
                usage={stats.activeSubscriptions}
              />
              <StatCard
                title="MRR"
                value={mrrDisplay}
                subtitle="Monthly Recurring Revenue"
                icon={<LoopIcon className="text-muted-foreground size-5" />}
                sparkData={stats.charts.revenue}
                color="var(--chart-2)"
                tooltipValueFormatter={(v) => usdCentsToDisplay(v, selectedItem, fiatRates)}
              />
              <StatCard
                title="Revenue"
                value={revenue28}
                subtitle={`Last ${period} days`}
                icon={<DollarIcon className="text-muted-foreground size-5" />}
                sparkData={stats.charts.revenue}
                color="var(--chart-2)"
                tooltipValueFormatter={(v) => usdCentsToDisplay(v, selectedItem, fiatRates)}
              />
              <StatCard
                title="New Customers"
                value={stats.newCustomers}
                subtitle={`Last ${period} days`}
                icon={<AddUserIcon className="text-muted-foreground size-5" />}
                sparkData={stats.charts.customers}
                color="var(--chart-3)"
                href="/customers"
              />
              <StatCard
                title="Active Customers"
                value={stats.totalCustomers}
                subtitle="In total"
                icon={<GroupedUsersIcon className="text-muted-foreground size-5" />}
                sparkData={stats.charts.customers}
                color="var(--chart-3)"
                usage={stats.totalCustomers}
              />
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-border/60 bg-card overflow-hidden rounded-2xl shadow-xs">
      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20 sm:h-9" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="size-10 shrink-0 rounded-xl" />
        </div>
        <Skeleton className="relative -mx-6 mt-1 h-28 rounded-b-2xl" />
      </CardContent>
    </Card>
  );
}

function StatCardsSkeleton() {
  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-36 md:h-9 md:w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-[140px] rounded-lg" />
          <Skeleton className="h-9 w-[200px] rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  sparkData,
  color,
  usage,
  max,
  href,
  tooltipValueFormatter,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  sparkData: { i: string; value: number }[];
  color: string;
  usage?: number;
  max?: number;
  href?: string;
  tooltipValueFormatter?: (value: number) => string;
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
        "border-border/60 bg-card group relative overflow-hidden rounded-2xl shadow-xs transition-shadow",
        href && "cursor-pointer hover:shadow-sm"
      )}
    >
      <button
        onClick={handleShare}
        title={`Share ${title}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 z-10 flex size-6 cursor-pointer items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100"
      >
        <ArrowUpRight className="size-3.5" />
      </button>

      <CardContent className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{title}</p>
            <div className="flex items-center gap-3">
              <p className="text-foreground text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="text-muted-foreground/50 size-3 shrink-0" aria-hidden />
              <p className="text-muted-foreground text-xs">{subtitle}</p>
            </div>
          </div>
          <div
            className="bg-muted/80 flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5"
            style={{ color }}
          >
            {icon}
          </div>
        </div>

        <div className="relative -mx-6 mt-1 h-28 overflow-hidden rounded-b-2xl">
          <LineChart
            data={chartData}
            config={SPARKLINE_CONFIG}
            xAxisKey="i"
            activeKey="value"
            color={color as "var(--chart-1)"}
            className="h-full w-full"
            showXAxis={false}
            showTooltip={true}
            showGrid={false}
            tooltipFormatter={
              tooltipValueFormatter ? (value: unknown) => tooltipValueFormatter(Number(value)) : undefined
            }
          />
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
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
