import type { ReactNode } from "react";

import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Construction, ExternalLink, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InstallAppButton } from "../install-app-button";
import { getMarketplaceApp } from "../marketplace-apps";

function MetaBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-foreground text-sm font-semibold">{label}</p>
      <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default async function MarketplaceAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = getMarketplaceApp(id);
  if (!app) notFound();

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <Breadcrumb className="mb-8">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/marketplace">Marketplace</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">{app.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {app.status === "coming-soon" && (
            <div className="mb-8 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <Construction className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Integration in development</p>
                <p className="text-sm text-amber-800/80 dark:text-amber-300/70">
                  This integration is actively being built and is not yet available to install. Click &ldquo;Install
                  app&rdquo; below to join the waitlist and get notified when it launches.
                </p>
              </div>
            </div>
          )}

          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-4">
              <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border sm:h-20 sm:w-20">
                <Image
                  src={app.iconUrl}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  priority
                  unoptimized
                />
              </div>
              <div className="min-w-0 space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{app.name}</h1>
                <p className="text-muted-foreground max-w-xl text-base leading-relaxed">{app.tagline}</p>
                <Badge variant="secondary" className="font-normal">
                  {app.category}
                </Badge>
              </div>
            </div>
            <div className="shrink-0 sm:pt-1">
              <InstallAppButton appName={app.name} appId={app.id} appCategory={app.category} />
            </div>
          </div>

          <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
            <aside className="w-full shrink-0 space-y-8 lg:max-w-xs">
              <MetaBlock label="Built by">{app.publisher}</MetaBlock>
              <MetaBlock label="Visible on">{app.visibleOn}</MetaBlock>
              <MetaBlock label="Works with">
                <ul className="list-inside list-disc space-y-1">
                  {app.worksWith.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </MetaBlock>
              <MetaBlock label="Pricing">{app.pricing}</MetaBlock>
              <MetaBlock label="Supported languages">{app.languages}</MetaBlock>
              <div className="space-y-1.5">
                <p className="text-foreground text-sm font-semibold">Support</p>
                <a
                  href={`mailto:${app.supportEmail}`}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {app.supportEmail}
                </a>
                <div>
                  <a
                    href={app.supportSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                  >
                    Support site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-foreground text-sm font-semibold">Resources</p>
                <a
                  href={app.companyWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                >
                  Company website
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-muted-foreground/80 text-xs">
                <button type="button" className="underline-offset-4 hover:underline">
                  Report app to StellarTools
                </button>{" "}
              </p>
            </aside>

            <div className="min-w-0 flex-1 space-y-10">
              <Separator className="lg:hidden" />
              <div>
                <p className="text-muted-foreground mb-8 text-xs font-semibold tracking-widest uppercase">Features</p>
                <div className="space-y-14">
                  {app.features.map((feature) => (
                    <article key={feature.title} className="space-y-4">
                      <div className="bg-muted/40 border-border/80 relative aspect-video w-full overflow-hidden rounded-xl border">
                        <Image
                          src={app.iconUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 640px"
                          unoptimized
                        />
                      </div>
                      <h2 className="text-xl font-semibold tracking-tight">{feature.title}</h2>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
