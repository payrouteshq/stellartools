import React from "react";

const currencies = [
  { flag: "🇳🇬", name: "Nigerian Naira", code: "NGN" },
  { flag: "🇰🇪", name: "Kenyan Shilling", code: "KES" },
  { flag: "🇬🇭", name: "Ghanaian Cedi", code: "GHS" },
];

export default function PayoutsSection() {
  return (
    <section className="bg-secondary px-6 py-24 sm:px-10" id="payouts">
      <div className="mx-auto max-w-[640px]">
        <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">Global Payouts</div>
        <h2 className="text-foreground mb-5 text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
          Get paid in crypto.
          <br />
          <em className="text-primary italic">Cash out locally.</em>
        </h2>
        <p className="text-muted-foreground mb-7 text-[17px] leading-relaxed">
          StellarTools bridges the gap between on-chain settlement and real-world money. Withdraw your XLM balance
          directly to a Stellar wallet, or convert and cash out to local currency — no exchange accounts or extra steps.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {currencies.map((currency) => (
            <div
              key={currency.code}
              className="bg-card border-border text-muted-foreground flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
            >
              <span className="text-lg">{currency.flag}</span> {currency.name} ({currency.code})
            </div>
          ))}
          <div className="bg-card border-border text-muted-foreground flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium opacity-50">
            <span className="text-lg">🌍</span> More coming soon…
          </div>
        </div>
      </div>
    </section>
  );
}
