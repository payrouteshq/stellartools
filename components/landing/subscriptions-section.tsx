"use client";

import { CheckList } from "@/components/checklist";

const features = [
  "Free trials with automatic conversion",
  "Prorate upgrades and downgrades",
  "Smart contract-enforced renewal logic",
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
          <em className="text-primary italic">enforced on-chain.</em>
        </h2>
        <p className="text-muted-foreground mb-7 text-[17px] leading-relaxed">
          Our Soroban smart contracts handle subscription state, renewals, cancellations, upgrades transparently and
          automatically. You set the rules once. The blockchain enforces them forever.
        </p>
        <CheckList items={features} className="text-[15px]" />
      </div>
    </section>
  );
}
