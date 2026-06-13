"use client";

import * as React from "react";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";

const WORDS = ["SaaS", "Agency", "Store", "Startup", "Platform", "Product"];

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

export default function HeroSection() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-28 pb-20 text-center">
      <p className="text-muted-foreground mb-5 text-[11px] font-semibold tracking-[1.6px] uppercase">
        A Payroutes company.
      </p>

      <h1 className="text-foreground mb-5 text-[clamp(36px,5.5vw,68px)] leading-[1.06] font-bold tracking-tight">
        Run your <CyclingWord />
        <br />
        onchain.
      </h1>

      <p className="text-muted-foreground mb-10 max-w-[480px] text-[17px] leading-relaxed">
        Accept payments across borders at near-zero cost. 3-second settlements, fractions of a cent per transaction —
        Stripe-like billing on Stellar.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? ""}/signup`}
          className="bg-foreground text-background rounded-lg px-6 py-2.5 text-[14.5px] font-semibold no-underline transition-all hover:opacity-90"
        >
          Get started free
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
