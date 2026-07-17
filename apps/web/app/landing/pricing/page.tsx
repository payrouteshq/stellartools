import { PricingCalc } from "@/app/landing/pricing/pricing-calc";
import { FooterSection } from "@/components/footer-section";
import { Header } from "@/components/navbar";

export default function PricingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
        <p className="text-muted-foreground mb-4 text-[11px] font-semibold tracking-[1.6px] uppercase">Pricing</p>
        <h1 className="text-foreground mb-4 text-[clamp(32px,4.5vw,56px)] font-bold tracking-tight">
          Pay for what you process
        </h1>
        <p className="text-muted-foreground mx-auto mb-16 max-w-md text-lg leading-relaxed">
          No seat fees, no monthly plans. A small percentage of payment volume.
        </p>

        <PricingCalc />
      </div>

      <FooterSection />
    </div>
  );
}
