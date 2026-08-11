import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

const features = [
  "No fixed fee per transaction",
  "No monthly or seat fees",
  "Accept USDC, XLM, or any Stellar asset",
  "Works globally from day one",
  "On-chain, instant settlement",
];

const comparison = [
  { provider: "StellarTools", rate: "1%", costAt1k: "$10", highlight: true },
  { provider: "Stripe", rate: "2.9% + $0.30", costAt1k: "$29.30", highlight: false },
  { provider: "PayPal", rate: "3.49% + $0.49", costAt1k: "$35.39", highlight: false },
  { provider: "Wire transfer", rate: "0.5–1% + $25–50", costAt1k: "$25–50+", highlight: false },
];

export function PricingCalc() {
  return (
    <main className="flex-1 px-6 py-24">
      <div className="mx-auto max-w-5xl">

        {/* Hero — compact */}
        <div className="mb-14 text-center">
          <p className="text-muted-foreground mb-4 text-[11px] font-semibold tracking-[1.6px] uppercase">
            Pricing
          </p>
          <h1 className="text-foreground mb-4 text-[clamp(32px,4.5vw,56px)] font-bold tracking-tight">
            Simple, honest pricing
          </h1>
          <p className="text-muted-foreground mx-auto mb-6 max-w-sm text-lg leading-relaxed">
            1% of what you process in crypto — USDC, XLM, or any Stellar asset. No fixed fees, no monthly plans.
          </p>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <span aria-hidden="true">🎉</span>
            First 100 merchants · Free for 6 months
          </span>
        </div>

        {/* Fee + comparison side by side */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-start">

          {/* Left: fee */}
          <div>
            <div className="text-foreground mb-1 text-[80px] font-bold leading-none tracking-tight tabular-nums">
              1%
            </div>
            <p className="text-muted-foreground mb-8 text-sm">per transaction · no fixed fee</p>

            <ul className="mb-10 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-foreground text-sm">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/signup`}
              className="bg-primary text-primary-foreground inline-block rounded-[9px] px-5 py-3 text-[14.5px] font-semibold no-underline transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(91,79,255,0.35)]"
            >
              Start for free →
            </Link>
          </div>

          {/* Right: comparison */}
          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-border border-b">
                  <th className="text-muted-foreground pb-3 text-left text-xs font-semibold tracking-wider uppercase">
                    Provider
                  </th>
                  <th className="text-muted-foreground pb-3 text-center text-xs font-semibold tracking-wider uppercase">
                    Rate
                  </th>
                  <th className="text-muted-foreground pb-3 text-right text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
                    Per $1,000
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.provider} className="border-border border-b last:border-b-0">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={row.highlight ? "text-foreground text-sm font-semibold" : "text-muted-foreground text-sm"}>
                          {row.provider}
                        </span>
                      </div>
                    </td>
                    <td className={`py-3.5 text-center text-sm tabular-nums ${row.highlight ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {row.rate}
                    </td>
                    <td className={`py-3.5 text-right text-sm font-semibold tabular-nums ${row.highlight ? "text-primary" : "text-muted-foreground"}`}>
                      {row.costAt1k}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-muted-foreground mt-4 text-xs">
              Stripe and PayPal accept cards and fiat. StellarTools is crypto-native — payments settle on the Stellar blockchain, not through card networks or banks.
            </p>
          </div>
        </div>

        {/* Volume — same strip style */}
        <div className="border-border mt-20 flex flex-col gap-6 border-t pt-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-[1.6px] uppercase">
              Volume
            </p>
            <h2 className="text-foreground mb-2 text-2xl font-bold tracking-tight">
              Processing over $50K/month?
            </h2>
            <p className="text-muted-foreground max-w-sm text-base">
              Below 1% is on the table. Reach out and we&apos;ll work something out.
            </p>
          </div>
          <Link
            href="/book-call"
            className="border-border text-foreground hover:bg-muted inline-flex shrink-0 items-center gap-2 rounded-[9px] border px-5 py-3 text-[14.5px] font-semibold no-underline transition-colors"
          >
            Talk to us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </main>
  );
}
