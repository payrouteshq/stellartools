"use client";

import React from "react";

import { Timeline, TimelineEntry } from "@/components/timeline";

const steps = [
  {
    number: "01",
    title: "Create your account & add your first product",
    description: "Sign up, create a product (one-time or subscription), and set your price in any currency.",
  },
  {
    number: "02",
    title: "Generate a payment link or use the API",
    description:
      "Share a hosted checkout link or integrate via our REST API and JS SDK. Your checkout page is managed by us.",
  },
  {
    number: "03",
    title: "Customer pays in seconds",
    description:
      "Your customer sees a clean, familiar checkout. Payment settles in 3–5 seconds — no waiting, no friction.",
  },
  {
    number: "04",
    title: "Get paid. Withdraw globally.",
    description:
      "Funds settle to your StellarTools account instantly. Withdraw to any wallet or bank account worldwide.",
  },
];

export default function HowItWorks() {
  const renderStep = (step: (typeof steps)[number], index: number): TimelineEntry => ({
    key: step.number,
    title: step.title,
    date: ``,
    data: {},
    contentOverride: <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>,
    titleClassName: "font-bold text-sm text-foreground",
  });

  return (
    <section className="bg-secondary px-6 py-24 sm:px-10" id="how-it-works">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">How It Works</div>
        <h2 className="text-foreground max-w-2xl text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
          From zero to collecting
          <br />
          payments in <em className="text-primary">minutes.</em>
        </h2>

        <div className="mt-16 max-w-xl">
          <Timeline items={steps} renderItem={renderStep} />
        </div>
      </div>
    </section>
  );
}
