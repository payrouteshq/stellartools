"use client";

import { FooterSection } from "@/components/footer-section";
import { HeroSection } from "@/components/hero-section";
import { Header } from "@/components/navbar";
import PrimitivesSection from "@/components/primitives-section";
import { VideoSection } from "@/components/video-section";

export default function Home() {
  return (
    <div className="force-light bg-background min-h-screen">
      <Header />
      <HeroSection />
      <VideoSection />
      <PrimitivesSection />
      <FooterSection />
    </div>
  );
}
