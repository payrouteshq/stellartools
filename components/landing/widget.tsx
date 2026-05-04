import React from "react";

import { cn } from "@/lib/utils";
import { BarChart3, RotateCcw, Tags } from "lucide-react";
import Image from "next/image";

import { GroupedUsersIcon, SubscriptionIcon } from "../icon";

const features = [
  {
    icon: GroupedUsersIcon,
    title: "Customer Management",
    description:
      "Create customers, track wallet addresses, segment by behaviour, import via CSV. Just like Stripe's customer object but your customers pay with XLM in seconds.",
    wide: true,
    dark: false,
    hasScreenshot: true,
    screenshotTitle: "Customers Page Screenshot",
    screenshotDescription: "Customers table with email, phone, wallet address",
  },
  {
    icon: RotateCcw,
    title: "Instant Refunds",
    description:
      "Issue refunds to customers in seconds not 5–10 business days. On-chain settlement means money goes back immediately.",
    wide: false,
    dark: true,
  },
  {
    icon: SubscriptionIcon,
    title: "Subscriptions",
    description:
      "Recurring billing powered by Soroban smart contracts. Trials, upgrades, cancellations all automated and verifiable on-chain.",
    wide: false,
    dark: false,
  },
  {
    icon: BarChart3,
    title: "Metered Billing",
    description:
      "Charge per API call, per token, per GB, any usage-based model. Native adapters for LangChain and AI SDK make metered AI billing a one-liner.",
    wide: false,
    dark: false,
  },
  {
    icon: Tags,
    title: "Products & Pricing",
    description:
      "Create one-time products, recurring plans, and custom pricing. Generate hosted checkout links in seconds.",
    wide: false,
    dark: false,
  },
];

export default function WidgetSection() {
  return (
    <section id="features" className="px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">The Platform</div>
        <h2 className="text-foreground mb-5 max-w-2xl text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
          Everything Stripe does.
          <br />
          <em className="text-primary">On the blockchain.</em>
          <br />
          With none of the complexity.
        </h2>
        <p className="text-muted-foreground mb-10 max-w-xl text-[17px] leading-relaxed">
          StellarTools is a complete payment engine that sits on top of the Stellar blockchain, giving you the developer
          experience of Stripe while your money moves on one of the world's fastest, lowest-fee settlement networks.
        </p>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={cn(
                "rounded-2xl border p-8 transition-all",
                feature.wide && "md:col-span-2",
                feature.dark
                  ? "bg-foreground border-foreground/10"
                  : "border-border hover:border-primary/20 bg-white hover:shadow-[0_8px_40px_rgba(0,0,0,0.06)]"
              )}
            >
              <div
                className={cn(
                  "mb-5 flex h-11 w-11 items-center justify-center rounded-xl",
                  feature.dark ? "bg-white/10" : "bg-primary/8 ring-primary/15 ring-1"
                )}
              >
                <feature.icon className={cn("h-5 w-5", feature.dark ? "text-white" : "text-primary")} />
              </div>
              <div
                className={cn(
                  "mb-2.5 text-lg font-semibold tracking-tight",
                  feature.dark ? "text-white" : "text-foreground"
                )}
              >
                {feature.title}
              </div>
              <div
                className={cn(
                  "text-[14.5px] leading-relaxed",
                  feature.dark ? "text-white/60" : "text-muted-foreground"
                )}
              >
                {feature.description}
              </div>

              {feature.hasScreenshot && (
                <div className="relative mt-4 overflow-hidden rounded-xl">
                  <Image
                    src="/images/overview-customer.png"
                    alt="Customers Overview"
                    width={600}
                    height={300}
                    className="h-auto w-full object-cover"
                  />
                  <div className="bg-primary absolute top-0 right-0 left-0 h-[3px]" />
                  <div className="absolute right-0 bottom-0 left-0 h-[20%] bg-linear-to-t from-white via-white/80 to-transparent" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
