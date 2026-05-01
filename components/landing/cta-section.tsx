"use client";

import Link from "next/link";

export default function CTASection() {
  return (
    <section className="bg-card px-10 py-32 text-center">
      <div className="mx-auto max-w-2xl">
        <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">Get started today</div>
        <h2 className="text-foreground mb-5 text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
          Ready to accept payments
          <br />
          <em className="text-primary italic">on the Stellar network?</em>
        </h2>
        <p className="text-muted-foreground mb-10 text-[17px] leading-relaxed">
          Create your account, add your first product, and start accepting payments in minutes. No blockchain knowledge
          required. Free to start.
        </p>
        <div className="flex flex-row items-center justify-center gap-3.5">
          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground rounded-xl px-7 py-3.5 text-base font-semibold no-underline transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(91,79,255,0.35)]"
          >
            Start for free
          </Link>
          <Link
            href="/docs"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-lg px-4 py-2 text-[15px] font-medium no-underline transition-colors"
          >
            Read the docs →
          </Link>
        </div>
      </div>
    </section>
  );
}
