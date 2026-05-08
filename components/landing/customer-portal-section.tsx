"use client";

import { StellarTools } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { CreditCard, FileText, Info, LayoutDashboard, RefreshCw } from "lucide-react";

const features = [
  {
    icon: RefreshCw,
    title: "Manage subscriptions",
    description: "Customers can pause, resume, or cancel subscriptions themselves — no support tickets.",
  },
  {
    icon: CreditCard,
    title: "Payment methods",
    description: "View and update saved payment methods. Cards or wallets tied to active subscriptions are protected.",
  },
  {
    icon: LayoutDashboard,
    title: "Usage & credits",
    description: "Live meter showing how many credits have been consumed and what's remaining.",
  },
  {
    icon: FileText,
    title: "Invoice history",
    description: "Every payment with its transaction hash and date, always accessible.",
  },
];

export default function CustomerPortalSection() {
  return (
    <section className="bg-card px-6 py-24 sm:px-10" id="portal">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2 md:gap-20">
        <div>
          <div className="text-primary mb-6 text-[12.5px] font-bold tracking-[1.2px] uppercase">Customer Portal</div>
          <h2 className="text-foreground mb-5 text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
            Self-service for
            <br />
            <em className="text-primary italic">your customers.</em>
          </h2>
          <p className="text-muted-foreground mb-10 text-[17px] leading-relaxed">
            Every customer gets a hosted portal to manage their own subscriptions, payment methods, usage, and invoices.
          </p>
          <div className="flex flex-col gap-7">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="bg-primary/10 flex h-10 w-10 min-w-[40px] items-center justify-center rounded-[10px]">
                  <feature.icon className="text-primary h-5 w-5" />
                </div>
                <div>
                  <div className="text-foreground mb-1.5 text-[15px] font-semibold">{feature.title}</div>
                  <div className="text-muted-foreground text-[13.5px] leading-relaxed">{feature.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="bg-background mx-auto max-w-[420px] overflow-hidden rounded-2xl border shadow-[0_40px_120px_rgba(0,0,0,0.12)]">
            <div className="bg-primary border-border flex items-center justify-center gap-1.5 border-b px-4 py-1.5">
              <Info className="text-secondary-foreground size-3" />
              <span className="text-secondary-foreground text-xs">
                You are in <span className="font-medium">Test mode</span>
              </span>
            </div>

            <div className="border-border flex items-center gap-2.5 border-b px-5 py-3.5">
              <StellarTools width={22} height={22} className="object-contain" />
              <span className="text-foreground text-sm font-semibold">StellarTools</span>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-full">
                  <span className="text-primary text-sm font-bold">J</span>
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">Jane Smith</p>
                  <p className="text-muted-foreground text-xs">jane@company.com</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-foreground mb-2 text-xs font-medium">Subscriptions</p>
                <div className="border-border rounded-xl border">
                  <div className="flex items-start justify-between px-4 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-foreground text-sm font-medium">Discord Unlimited</p>
                        <Badge className="text-[10px]">Active</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">Renews Jun 1, 2026</p>
                      <p className="text-muted-foreground text-xs">Visa •••• 4242</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" disabled className="h-7 text-xs">
                        Pause
                      </Button>
                      <Button variant="outline" size="sm" disabled className="h-7 text-xs">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-foreground mb-2 text-xs font-medium">Usage</p>
                <div className="border-border space-y-2 rounded-xl border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-foreground text-sm font-medium">API Credits</p>
                    <p className="text-muted-foreground text-xs">6,200 / 10,000 tokens</p>
                  </div>
                  <Slider
                    value={[62]}
                    min={0}
                    max={100}
                    disabled
                    className="**:data-[slot=slider-thumb]:size-3"
                    showKnobs={false}
                  />
                  <p className="text-muted-foreground text-xs">3,800 tokens remaining</p>
                </div>
              </div>

              <div>
                <p className="text-foreground mb-2 text-xs font-medium">Invoices</p>
                <div className="border-border divide-border divide-y rounded-xl border">
                  {[
                    { amount: "$9.99", date: "May 1, 2026", hash: "a3f92c…" },
                    { amount: "$9.99", date: "Apr 1, 2026", hash: "b81d04…" },
                  ].map((inv) => (
                    <div key={inv.hash} className="flex items-center justify-between px-4 py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-foreground text-sm font-medium">{inv.amount}</p>
                        <p className="text-muted-foreground text-xs">{inv.date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground font-mono text-xs">{inv.hash}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          Paid
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              <p className="text-muted-foreground text-center text-[10px]">Powered by StellarTools</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
