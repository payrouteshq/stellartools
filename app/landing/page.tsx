"use client";

import { AuroraBackground } from "@/components/aurora-background";
import { AppConnectionWidget } from "@/components/landing/app-connection-widget";
import CheckoutSection from "@/components/landing/checkout-section";
import CTASection from "@/components/landing/cta-section";
import CustomerPortalSection from "@/components/landing/customer-portal-section";
import DevelopersSection from "@/components/landing/developers-section";
import { FooterSection } from "@/components/landing/footer-section";
import HeroSection from "@/components/landing/hero-section";
import HowItWorks from "@/components/landing/how-it-works";
import { LaunchBanner } from "@/components/landing/launch-banner";
import LogosBelt from "@/components/landing/logos-belt";
import MarketplaceSection from "@/components/landing/marketplace-section";
import PayoutsSection from "@/components/landing/payouts-section";
import StatsSection from "@/components/landing/stats-section";
import SubscriptionsSection from "@/components/landing/subscriptions-section";
import TestimonialsSection from "@/components/landing/testimonials-section";
import WidgetSection from "@/components/landing/widget";
import { Header } from "@/components/ui/navbar";

export default function Home() {
  return (
    <div className="bg-background min-h-screen scroll-smooth">
      <LaunchBanner />
      <AuroraBackground className="bg-background">
        <Header />
        <HeroSection />
      </AuroraBackground>

      <LogosBelt />
      <WidgetSection />
      <HowItWorks />
      <CheckoutSection />
      <CustomerPortalSection />
      <StatsSection />
      <AppConnectionWidget />
      <PayoutsSection />
      <DevelopersSection />
      <MarketplaceSection />
      <SubscriptionsSection />
      <TestimonialsSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}
