"use client";

import DevelopersSection from "@/components/landing/developers-section";
import { FooterSection } from "@/components/landing/footer-section";
import HeroSection from "@/components/landing/hero-section";
import PrimitivesSection from "@/components/landing/primitives-section";
import { VideoSection } from "@/components/landing/video-section";
import { Header } from "@/components/ui/navbar";

export default function Home() {
  return (
    <div className="force-light bg-background min-h-screen">
      <Header />
      <HeroSection />
      <VideoSection />
      <DevelopersSection />
      <PrimitivesSection />
      <FooterSection />
    </div>
  );
}
