import { PricingCalc } from "@/app/landing/pricing/pricing-calc";
import { FooterSection } from "@/components/footer-section";
import { Header } from "@/components/navbar";

export default function PricingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Header />
      <PricingCalc />
      <FooterSection />
    </div>
  );
}
