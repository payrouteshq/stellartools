"use client";

import type { TCountryCode } from "countries-list";
import * as CountryFlags from "country-flag-icons/react/3x2";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

const FLAG_CODES: TCountryCode[] = [
  "US",
  "GB",
  "NG",
  "IN",
  "DE",
  "BR",
  "JP",
  "KE",
  "FR",
  "AU",
  "CA",
  "SG",
  "ZA",
  "MX",
  "KR",
  "AE",
  "ID",
  "SE",
  "GH",
  "NL",
  "AR",
  "EG",
  "IT",
  "ES",
  "PH",
];

function FlagStrip() {
  const flags = [...FLAG_CODES, ...FLAG_CODES];

  return (
    <div className="relative w-full max-w-[640px] overflow-hidden">
      <style>{`
        @keyframes flag-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .flag-marquee { animation: flag-marquee 28s linear infinite; }
      `}</style>

      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
        style={{ background: "linear-gradient(to right, var(--color-background), transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
        style={{ background: "linear-gradient(to left, var(--color-background), transparent)" }}
      />

      <div className="flag-marquee flex gap-3">
        {flags.map((code, i) => {
          const Flag = CountryFlags[code];
          return Flag ? (
            <Flag
              key={`${code}-${i}`}
              className="border-border/30 h-4 w-6 shrink-0 rounded border object-cover opacity-70"
            />
          ) : null;
        })}
      </div>
    </div>
  );
}

const WORDS = ["SaaS", "store", "startup", "API", "platform", "product"];

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
          className="text-secondary inline-block"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function HeroSection() {
  return (
    <section className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center gap-12 px-6 pt-24 pb-20 lg:gap-20">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-foreground mb-6 text-[clamp(38px,5vw,72px)] leading-[1.05] font-extrabold tracking-tight">
          Run your <CyclingWord /> <span className="text-secondary">onchain.</span>
        </h1>

        <p className="text-muted-foreground mx-auto mb-6 max-w-[520px] text-lg leading-relaxed font-normal">
          Accept payments, manage subscriptions, issue refunds, and automate billing on the Stellar blockchain.
        </p>

        <div className="mb-8 flex flex-col items-center gap-2">
          <FlagStrip />
          <p className="text-muted-foreground text-xs">Customers from every corner of the world</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="https://dashboard.stellartools.dev"
            target="_blank"
            className="bg-primary text-primary-foreground rounded-xl px-7 py-3.5 text-base font-semibold no-underline transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(91,79,255,0.35)]"
          >
            Start building free
          </Link>
          <Link
            href="#how-it-works"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-lg px-4 py-2 text-[15px] font-medium no-underline transition-colors"
          >
            See how it works →
          </Link>
        </div>
      </div>

      <div className="relative w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl">
        <Image
          src="/images/overview-dashboard.png"
          alt="Overview Dashboard Screenshot"
          width={1300}
          height={900}
          className="w-full"
        />
        <div className="from-primary to-primary absolute top-0 right-0 left-0 h-[4px] bg-linear-to-b" />
        <div className="absolute right-0 bottom-0 left-0 h-[5%] bg-gray-50" />
      </div>
    </section>
  );
}
