"use client";

import * as React from "react";

import { CheckList } from "@/components/checklist";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { BPS_DENOMINATOR, FREE_THRESHOLD_USD, getVolumeTierRateBps } from "@/lib/pricing";
import NumberFlow from "@number-flow/react";
import Link from "next/link";

const MILESTONES = [
  { value: 0, label: "$0" },
  { value: 5_000, label: "$5K" },
  { value: 10_000, label: "$10K" },
  { value: 50_000, label: "$50K" },
  { value: 100_000, label: "$100K" },
  { value: 250_000, label: "$250K" },
  { value: 500_000, label: "$500K" },
  { value: 1_000_000, label: "$1M" },
  { value: 3_000_000, label: "$3M" },
  { value: 5_000_000, label: "$5M" },
  { value: 10_000_000, label: "$10M" },
  { value: 20_000_000, label: "$20M" },
  { value: Infinity, label: "$20M+" },
] as const;

const MAX_SLIDER = MILESTONES.length - 1;

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function PricingCalc() {
  const [index, setIndex] = React.useState(4);
  const milestone = MILESTONES[index];
  const isEnterprise = milestone.value === Infinity;

  const volume = isEnterprise ? 0 : milestone.value;
  const isFree = volume <= FREE_THRESHOLD_USD;

  const rateBps = getVolumeTierRateBps(volume);
  const billableVolume = Math.max(0, volume - FREE_THRESHOLD_USD);
  const fee = (billableVolume * rateBps) / BPS_DENOMINATOR;

  const pct = volume > 0 ? (fee / volume) * 100 : 0;

  return (
    <div className="bg-card border-border rounded-2xl border p-8 shadow-sm">
      <div className="mb-10 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm font-medium">Monthly payment volume</p>
          <p className="text-foreground text-sm font-semibold">{isEnterprise ? "$20M+" : formatUsd(volume)}</p>
        </div>

        <div className="relative px-1">
          <Slider
            min={0}
            max={MAX_SLIDER}
            step={1}
            value={[index]}
            onValueChange={([v]) => setIndex(v)}
            className="**:data-[slot=slider-thumb]:border-background **:data-[slot=slider-thumb]:bg-primary **:data-[slot=slider-thumb]:shadow-primary/30 **:data-[slot=slider-thumb]:ring-background/50 **:data-[slot=slider-thumb]:size-5 **:data-[slot=slider-thumb]:border-2 **:data-[slot=slider-thumb]:shadow-lg **:data-[slot=slider-thumb]:ring-2 **:data-[slot=slider-thumb]:transition-all **:data-[slot=slider-thumb]:hover:scale-110"
          />
        </div>

        <div className="text-muted-foreground flex justify-between px-1 text-xs">
          <span>$0</span>
          <span>$1M</span>
          <span>$20M+</span>
        </div>
      </div>

      {isEnterprise ? (
        <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="text-foreground text-2xl font-semibold">Let&apos;s talk</p>
            <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
              At this scale, rates are negotiated directly. We&apos;ll design a custom solution around how your business
              operates.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <CheckList
              items={[
                "Dedicated email infrastructure and delivery tuning",
                "Flexible data and reporting setup (warehouse, lake, or both)",
                "Deeper integration support and roadmap input",
              ]}
            />
            <Button size="lg" className="mt-1 w-full">
              <Link className="w-full text-center" href="/book-call">
                Contact sales
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          <Stat
            label="Monthly volume"
            value={
              <NumberFlow
                value={volume}
                format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
                className="text-foreground text-2xl font-bold"
              />
            }
          />
          <Stat
            label="StellarTools fee"
            value={
              isFree ? (
                <span className="text-primary text-2xl font-bold">Free</span>
              ) : (
                <NumberFlow
                  value={fee}
                  format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
                  className="text-foreground text-2xl font-bold"
                />
              )
            }
            note={isFree ? "First $10K" : undefined}
          />
          <Stat
            label="Effective rate"
            value={
              isFree ? (
                <span className="text-primary text-2xl font-bold">0%</span>
              ) : (
                <span className="text-foreground text-2xl font-bold">{pct.toFixed(2)}%</span>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      {value}
      {note && <p className="text-muted-foreground text-xs">{note}</p>}
    </div>
  );
}
