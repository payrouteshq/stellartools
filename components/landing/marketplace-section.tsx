import { MARKETPLACE_APPS } from "@/app/dashboard/(dashboard)/marketplace/marketplace-apps";
import Image from "next/image";
import Link from "next/link";

export default function MarketplaceSection() {
  return (
    <section className="px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12 text-center">
          <p className="text-muted-foreground mb-3 text-[12.5px] font-bold tracking-[1.2px] uppercase">Marketplace</p>
          <h2 className="mb-4 text-[clamp(30px,4vw,46px)] leading-[1.15] font-bold tracking-tight">
            Use your favourite apps
            <br />
            with StellarTools.
          </h2>
          <p className="text-muted-foreground mx-auto max-w-[480px] text-[17px] leading-relaxed">
            Connect the tools your team already relies on. More integrations shipping every month.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-4">
          {MARKETPLACE_APPS.map((app) => (
            <div
              key={app.id}
              className="border-border bg-card flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-sm"
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                <Image src={app.iconUrl} alt={app.name} fill className="object-cover" unoptimized />
              </div>
              <div>
                <p className="text-foreground text-sm font-semibold">{app.name}</p>
                <p className="text-muted-foreground text-[12px]">{app.category}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL}/marketplace`}
            target="_blank"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Browse the marketplace
          </Link>
        </div>
      </div>
    </section>
  );
}
