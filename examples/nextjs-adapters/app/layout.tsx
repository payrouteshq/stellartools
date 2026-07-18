import { StellarToolsIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { fileRouter } from "@/lib/uploadthing";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { extractRouterConfig } from "uploadthing/server";

import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ weight: "400", variable: "--font-instrument-serif", subsets: ["latin"] });
const jetBrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StellarTools Adapter Demos",
  description: "Interactive demos for every StellarTools adapter",
};

const NAV = [
  { href: "/", label: "Overview", img: null, external: false },
  { href: "/betterauth", label: "BetterAuth", img: "/images/integrations/better-auth.png", external: false },
  { href: "/aisdk", label: "AI SDK", img: "/images/integrations/aisdk.jpg", external: false },
  { href: "/langchain", label: "LangChain", img: "/images/integrations/langchain.png", external: false },
  { href: "/uploadthing", label: "UploadThing", img: "/images/integrations/uploadthing.png", external: false },
  {
    href: "https://stellartools-medusajs-storefront.vercel.app/",
    label: "MedusaJS",
    img: "/images/integrations/medusa.jpeg",
    external: true,
  },
  {
    href: "https://stellartools-production.up.railway.app/product/stellartools-license",
    label: "WooCommerce",
    img: "/images/integrations/wordpress.png",
    external: true,
  },
  {
    href: "https://stellartools-testnet.myshopify.com",
    label: "Shopify",
    img: "/images/integrations/shopify.png",
    external: true,
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${instrumentSerif.variable} ${jetBrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        <NextSSRPlugin routerConfig={extractRouterConfig(fileRouter)} />
        <Providers>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <nav className="bg-sidebar border-sidebar-border sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r px-3 py-5">
              <div className="mb-5 flex items-center gap-2 px-2">
                <StellarToolsIcon className="text-foreground size-5 shrink-0" />
                <div>
                  <p className="text-foreground text-[12px] font-semibold tracking-tight">StellarTools</p>
                  <p className="text-muted-foreground/60 text-[11px]">Adapter Playground</p>
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                {NAV.map((item) => {
                  const content = (
                    <>
                      {item.img ? (
                        <Image
                          src={item.img}
                          alt={item.label}
                          width={18}
                          height={18}
                          className="rounded-[4px] object-contain"
                        />
                      ) : (
                        <span className="bg-muted text-muted-foreground flex size-[18px] items-center justify-center rounded-[4px] text-[10px]">
                          ✦
                        </span>
                      )}
                      {item.label}
                    </>
                  );
                  const cls =
                    "text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors";
                  return item.external ? (
                    <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
                      {content}
                    </a>
                  ) : (
                    <Link key={item.href} href={item.href} className={cls}>
                      {content}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-auto px-2 pt-4">
                <a
                  href="https://docs.stellartools.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border hover:bg-sidebar-accent block rounded-lg border p-3 transition-colors"
                >
                  <p className="text-muted-foreground text-[11px]">
                    Docs at <span className="text-foreground font-medium">docs.stellartools.dev</span>
                  </p>
                </a>
              </div>
            </nav>

            {/* Main */}
            <div className="flex min-h-screen flex-1 flex-col overflow-y-auto">
              <header className="bg-background/80 border-border sticky top-0 z-10 flex h-12 shrink-0 items-center justify-end border-b px-6 backdrop-blur">
                <ThemeToggle />
              </header>
              <main className="flex-1">
                <div className="mx-auto max-w-2xl px-10 pt-6 pb-10">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
