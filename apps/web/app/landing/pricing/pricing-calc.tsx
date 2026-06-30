"use client";

import * as React from "react";

import NumberFlow from "@number-flow/react";
import { Slider } from "@stellartools/shared-ui";

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
] as const;

const MAX_SLIDER = MILESTONES.length - 1;

export function PricingCalc() {
  const [index, setIndex] = React.useState(4);
  const volume = MILESTONES[index].value;
  const fee = volume * 0.01;

  return (
    <div className="bg-card border-border rounded-2xl border p-8 shadow-sm">
      <div className="mb-10 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm font-medium">Monthly payment volume</p>
          <p className="text-foreground text-sm font-semibold">
            <NumberFlow value={volume} format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
          </p>
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
          <span>$10M</span>
        </div>
      </div>

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
            <NumberFlow
              value={fee}
              format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
              className="text-foreground text-2xl font-bold"
            />
          }
        />
        <Stat label="Rate" value={<span className="text-foreground text-2xl font-bold">1%</span>} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      {value}
    </div>
  );
}
