"use client";

import { CheckList } from "@/components/checklist";

const features = [
  "Free trials with automatic conversion",
  "Prorate upgrades and downgrades",
  "Automatic renewals and failed-payment handling",
  "Flexible billing cycles e.g hourly, daily, etc",
  "Webhook on every lifecycle event",
];

export default function SubscriptionsSection() {
  return (
    <section className="bg-card px-10 py-24" id="subscriptions">
      <div className="mx-auto max-w-[640px]">
        <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">Subscriptions</div>
        <h2 className="text-foreground mb-5 text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
          Recurring revenue,
          <br />
          <em className="text-primary italic">on autopilot.</em>
        </h2>
        <p className="text-muted-foreground mb-7 text-[17px] leading-relaxed">
          Set up subscription billing once and let StellarTools handle renewals, cancellations, upgrades, and failed
          payments automatically. You focus on your product — we handle the billing.
        </p>
        <CheckList items={features} className="text-[15px]" />
      </div>
    </section>
  );
}
