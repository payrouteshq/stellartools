import { Money } from "@/lib/money";
import { NormalizedChartPoint, normalizeTimeSeries } from "@/lib/utils";

export type CurrencyBucket = { currencyCode: string; cents: number };

export type DatedCount = { date: string; count: number };

export type OverviewStatsInput = {
  metrics: { activeSubscriptions: number | string; activeTrials: number | string; totalCustomers: number | string };
  mrrBuckets: CurrencyBucket[];
  grossBuckets: CurrencyBucket[];
  feeBuckets: CurrencyBucket[];
  revenueChart: { date: string; currencyCode: string; grossCents: number }[];
  feeChart: { date: string; currencyCode: string; feeCents: number }[];
  customersChart: DatedCount[];
  trialsChart: DatedCount[];
  activeSubscriptionsChart: DatedCount[];
  mrrChart: { date: string; currencyCode: string; cents: number }[];
};

export type OverviewStatsOptions = {
  targetCurrency: string;
  rates: Record<string, number>;
  dayCount: number;
};

export type OverviewStats = {
  activeTrials: number;
  activeSubscriptions: number;
  totalCustomers: number;
  newCustomers: number;
  mrrCents: number;
  netRevenueCents: number;
  currency: string;
  charts: {
    mrr: NormalizedChartPoint[];
    activeSubscriptions: NormalizedChartPoint[];
    revenue: NormalizedChartPoint[];
    customers: NormalizedChartPoint[];
    trials: NormalizedChartPoint[];
  };
};

const sumBuckets = (buckets: CurrencyBucket[], target: string, rates: Record<string, number>): number =>
  buckets.reduce((acc, b) => acc + Money.convert(b.cents, b.currencyCode, target, rates), 0);

/**
 * Pure aggregation for the dashboard overview: converts every currency bucket
 * into the target currency, nets fees out of gross revenue (both totals and the
 * daily series), and shapes the time series for the charts.
 */
export const computeOverviewStats = (input: OverviewStatsInput, options: OverviewStatsOptions): OverviewStats => {
  const { targetCurrency, rates, dayCount } = options;

  const mrrCents = sumBuckets(input.mrrBuckets, targetCurrency, rates);
  const totalGross = sumBuckets(input.grossBuckets, targetCurrency, rates);
  const totalFees = sumBuckets(input.feeBuckets, targetCurrency, rates);
  const netRevenueCents = totalGross - totalFees;

  // Net revenue per day = gross for the day minus platform fees for the day.
  const netRevMap = new Map<string, number>();
  for (const b of input.revenueChart) {
    netRevMap.set(
      b.date,
      (netRevMap.get(b.date) ?? 0) + Money.convert(b.grossCents, b.currencyCode, targetCurrency, rates)
    );
  }
  for (const b of input.feeChart) {
    netRevMap.set(
      b.date,
      (netRevMap.get(b.date) ?? 0) - Money.convert(b.feeCents, b.currencyCode, targetCurrency, rates)
    );
  }

  const mrrDayMap = new Map<string, number>();
  for (const b of input.mrrChart) {
    mrrDayMap.set(b.date, (mrrDayMap.get(b.date) ?? 0) + Money.convert(b.cents, b.currencyCode, targetCurrency, rates));
  }

  const toSeries = (map: Map<string, number>) =>
    normalizeTimeSeries(
      Array.from(map.entries()).map(([date, value]) => ({ date, value })),
      dayCount,
      "day"
    );

  return {
    activeTrials: Number(input.metrics.activeTrials),
    activeSubscriptions: Number(input.metrics.activeSubscriptions),
    totalCustomers: Number(input.metrics.totalCustomers),
    newCustomers: input.customersChart.reduce((acc, curr) => acc + curr.count, 0),
    mrrCents,
    netRevenueCents,
    currency: targetCurrency,
    charts: {
      mrr: toSeries(mrrDayMap),
      activeSubscriptions: normalizeTimeSeries(
        input.activeSubscriptionsChart.map((m) => ({ date: m.date, value: m.count })),
        dayCount,
        "day"
      ),
      revenue: toSeries(netRevMap),
      customers: normalizeTimeSeries(
        input.customersChart.map((c) => ({ date: c.date, value: c.count })),
        dayCount,
        "day"
      ),
      trials: normalizeTimeSeries(
        input.trialsChart.map((t) => ({ date: t.date, value: t.count })),
        dayCount,
        "day"
      ),
    },
  };
};
