"use client";

import Image from "next/image";
import Link from "next/link";

const ADAPTERS = [
  {
    href: "/betterauth",
    img: "/images/integrations/better-auth.png",
    name: "BetterAuth",
    pkg: "@stellartools/betterauth-adapter",
  },
  { href: "/aisdk", img: "/images/integrations/aisdk.jpg", name: "AI SDK", pkg: "@stellartools/aisdk-adapter" },
  {
    href: "/langchain",
    img: "/images/integrations/langchain.png",
    name: "LangChain",
    pkg: "@stellartools/langchain-adapter",
  },
  {
    href: "/uploadthing",
    img: "/images/integrations/uploadthing.png",
    name: "UploadThing",
    pkg: "@stellartools/uploadthing-adapter",
  },
];

const STORES = [
  {
    name: "MedusaJS",
    href: "https://stellartools-medusajs-storefront.vercel.app",
    hint: "Add the product to cart and go through checkout",
    img: "/images/integrations/medusa.svg",
  },
  {
    name: "WooCommerce",
    href: "https://stellartools-production.up.railway.app/product/stellartools-license",
    hint: "Add the product to cart and go through checkout",
    img: "/images/integrations/wordpress.png",
  },
  {
    name: "Shopify",
    href: "https://stellartools-testnet.myshopify.com",
    hint: "Password: test123",
    img: "/images/integrations/shopify.png",
  },
];

export default function OverviewPage() {
  return (
    <div className="space-y-10">
      <div>
        <div className="mb-1 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Adapter Playground</h1>
          <a
            href="https://github.com/payroutes/stellartools/tree/main/examples/nextjs-adapters"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 pt-1 text-xs transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View source
          </a>
        </div>
      </div>

      <div className="space-y-1.5">
        {ADAPTERS.map((a) => (
          <Link key={a.href} href={a.href} className="group block">
            <div className="border-border hover:bg-muted/30 flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors">
              <div className="bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg border">
                <Image src={a.img} alt={a.name} width={20} height={20} className="rounded object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-muted-foreground font-mono text-[11px]">{a.pkg}</p>
              </div>
              <span className="text-muted-foreground/30 group-hover:text-muted-foreground text-base transition-colors">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">Live test stores</h2>
        <div className="space-y-1.5">
          {STORES.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="group block">
              <div className="border-border hover:bg-muted/30 flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors">
                {"img" in s && s.img && (
                  <div className="bg-muted/60 flex size-9 shrink-0 items-center justify-center rounded-lg border">
                    <Image src={s.img} alt={s.name} width={20} height={20} className="rounded object-contain" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-muted-foreground text-xs">{s.hint}</p>
                </div>
                <span className="text-muted-foreground/30 group-hover:text-muted-foreground text-base transition-colors">
                  ↗
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
