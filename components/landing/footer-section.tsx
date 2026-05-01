import { Discord, Linkedin, StellarTools, XIcon } from "@/components/icon";
import { Heart } from "lucide-react";
import Link from "next/link";

const footerLinks = {
  product: [
    { name: "Payments", href: "#" },
    { name: "Subscriptions", href: "#subscriptions" },
    { name: "Metered Billing", href: "#" },
    { name: "Checkout", href: "#checkout" },
    { name: "Payouts", href: "#payouts" },
  ],
  integrations: [
    { name: "LangChain", href: "#" },
    { name: "AI SDK", href: "#" },
    { name: "MedusaJS", href: "#" },
    { name: "BetterAuth", href: "#" },
    { name: "UploadThing", href: "#" },
  ],
  developers: [
    { name: "Documentation", href: "/docs" },
    { name: "API Reference", href: "/docs/api" },
    { name: "GitHub", href: "https://github.com/usepaykit/stellartools" },
  ],
};

export const FooterSection = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary-foreground px-10 py-16 text-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-16 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="mb-4 flex items-center gap-2.5 text-[17px] font-semibold text-white">
            <StellarTools width={25} height={25} className="object-contain" />
            StellarTools
          </Link>
          <p className="max-w-[260px] text-sm leading-relaxed text-white/50">
            Payment infrastructure for the Stellar blockchain. Accept payments, manage subscriptions, and withdraw to
            local currency, all from one platform.
          </p>
          <div className="mt-5 flex items-center gap-4">
            <Link
              href="https://x.com/stellartoolsorg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 transition-colors hover:text-white"
            >
              <XIcon className="size-4" />
            </Link>
            <Link
              href="https://www.linkedin.com/company/stellartoolsorg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 transition-colors hover:text-white"
            >
              <Linkedin className="size-4" />
            </Link>
            <Link
              href="https://discord.gg/fNtD7Q9tPK"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 transition-colors hover:text-white"
            >
              <Discord className="size-4" />
            </Link>
          </div>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold tracking-widest text-white/40 uppercase">Product</div>
          <ul className="flex list-none flex-col gap-2.5">
            {footerLinks.product.map((link) => (
              <li key={link.name}>
                <Link
                  href={link.href}
                  className="text-sm text-white/60 no-underline transition-colors hover:text-white"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold tracking-widest text-white/40 uppercase">Integrations</div>
          <ul className="flex list-none flex-col gap-2.5">
            {footerLinks.integrations.map((link) => (
              <li key={link.name}>
                <Link
                  href={link.href}
                  className="text-sm text-white/60 no-underline transition-colors hover:text-white"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-4 text-xs font-bold tracking-widest text-white/40 uppercase">Developers</div>
          <ul className="flex list-none flex-col gap-2.5">
            {footerLinks.developers.map((link) => (
              <li key={link.name}>
                <Link
                  href={link.href}
                  className="text-sm text-white/60 no-underline transition-colors hover:text-white"
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1200px] flex-col items-center justify-between gap-4 border-t border-white/8 pt-6 text-[13px] text-white/30 sm:flex-row">
        <span>© {currentYear} StellarTools</span>
        <div className="flex items-center gap-4">
          <Link href="#" className="transition-colors hover:text-white/60">
            Terms
          </Link>
          <span>·</span>
          <Link href="#" className="transition-colors hover:text-white/60">
            Privacy
          </Link>
          <span>·</span>
          <Link href="#" className="transition-colors hover:text-white/60">
            Support
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-6 flex max-w-[1200px] justify-center">
        <Link
          href="https://usepaykit.dev"
          target="_blank"
          className="flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/60"
        >
          <span>Built with</span>
          <Heart className="h-4 w-4 fill-red-500 text-red-500" />
          <span>by</span>
          <span className="font-semibold text-white">Paykit</span>
        </Link>
      </div>
    </footer>
  );
};
