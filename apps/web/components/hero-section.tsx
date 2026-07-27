"use client";

import * as React from "react";

import { GitHub } from "@/components/icon";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

const GITHUB_URL = "https://github.com/payrouteshq/stellartools";

const WORDS = ["SaaS", "Agency", "Marketplace", "Startup", "Store"];

function CyclingWord() {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="relative inline-block">
      <AnimatePresence mode="wait">
        <motion.span
          key={WORDS[index]}
          initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
          transition={{ duration: 0.38, ease: [0.25, 0.1, 0.25, 1] }}
          className="inline-block"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function HeroSection() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-28 pb-20 text-center">
      <h1 className="text-foreground mb-5 text-[clamp(36px,5.5vw,68px)] leading-[1.06] font-bold tracking-tight">
        Payments for your <CyclingWord />,
        <br />
        built on Stellar.
      </h1>

      <p className="text-muted-foreground mb-10 max-w-120 text-[17px] leading-relaxed">
        Accept payments from anywhere and cash out to your bank. Open-source, Stripe-like billing on Stellar that
        settles in seconds for pennies.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? ""}/signup`}
          className="bg-foreground text-background rounded-lg px-6 py-2.5 text-[14.5px] font-semibold no-underline transition-all hover:opacity-90"
        >
          Get started free
        </Link>
        <Link
          href={GITHUB_URL}
          target="_blank"
          className="border-border text-foreground inline-flex items-center gap-2 rounded-lg border px-6 py-2.5 text-[14.5px] font-semibold no-underline transition-all hover:opacity-90"
        >
          <GitHub className="size-4" />
          Star on GitHub
        </Link>
        <Link
          href={process.env.NEXT_PUBLIC_DOCS_URL ?? "#"}
          target="_blank"
          className="text-muted-foreground hover:text-foreground rounded-lg px-6 py-2.5 text-[14.5px] font-medium no-underline transition-colors"
        >
          Read the docs →
        </Link>
      </div>
    </section>
  );
}
