"use client";

import { FooterSection } from "@/components/footer-section";
import { Header } from "@/components/navbar";
import { Skeleton } from "@stellartools/shared-ui";

export default function PricingLoading() {
  return (
    <div className="bg-background min-h-screen scroll-smooth">
      <Header />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-16 flex flex-col items-center gap-4 text-center">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>

        <div className="mb-10 flex justify-center">
          <Skeleton className="h-10 w-64 rounded-lg" />
        </div>

        <div className="mb-32 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[380px] rounded-xl" />
          ))}
        </div>
      </main>
      <FooterSection />
    </div>
  );
}
