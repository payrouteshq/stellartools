import { Payroutes, StellarToolsIcon } from "@/components/icon";
import { Linkedin, Twitter } from "lucide-react";
import Link from "next/link";

const links = [
  { label: "Docs", href: process.env.NEXT_PUBLIC_DOCS_URL ?? "#" },
  { label: "API Reference", href: `${process.env.NEXT_PUBLIC_DOCS_URL ?? ""}/api-reference` },
  { label: "GitHub", href: "https://github.com/payrouteshq/stellartools" },
  { label: "Pricing", href: "/pricing" },
];

const social = [
  { label: "X", href: "https://x.com/stellartoolsorg", icon: Twitter },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/stellartoolsorg", icon: Linkedin },
];

export const FooterSection = () => (
  <footer className="border-border border-t px-6 py-12">
    <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <StellarToolsIcon width={22} height={22} className="text-foreground" />
          <span className="text-foreground text-sm font-semibold">StellarTools</span>
        </Link>
        <p className="text-muted-foreground text-xs">built for the Stellar blockchain</p>
        <Link
          href="https://payroutes.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-1.5 no-underline"
        >
          <span className="text-muted-foreground text-xs">by</span>
          <Payroutes className="text-foreground size-4" />
          <span className="text-muted-foreground text-xs font-medium">Payroutes</span>
        </Link>
      </div>

      <div className="flex flex-col items-start gap-4 sm:items-end">
        <nav className="flex flex-wrap gap-x-8 gap-y-2 sm:justify-end">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-muted-foreground hover:text-foreground text-sm no-underline transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {social.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon className="size-4" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  </footer>
);
