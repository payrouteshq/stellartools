import React from "react";

export default function PayoutsSection() {
  return (
    <section className="bg-secondary px-6 py-24 sm:px-10" id="payouts">
      <div className="mx-auto max-w-[640px]">
        <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">Global Payouts</div>
        <h2 className="text-foreground mb-5 text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
          Send and receive money
          <br />
          <em className="text-primary italic">anywhere in the world.</em>
        </h2>
        <p className="text-muted-foreground mb-7 text-[17px] leading-relaxed">
          StellarTools settles payments globally in seconds — not days. Accept fiat or crypto, and pay out to any wallet
          or bank account worldwide with near-zero fees.
        </p>
      </div>
    </section>
  );
}
