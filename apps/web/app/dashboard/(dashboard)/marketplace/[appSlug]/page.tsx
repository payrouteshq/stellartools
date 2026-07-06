import * as React from "react";

import { retrieveApps } from "@/actions/app";
import { InstallAppButton } from "@/app/dashboard/(dashboard)/marketplace/install-app-button";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { APP_CONFIG } from "@stellartools/app-sdk/schema";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Separator,
} from "@stellartools/shared-ui";
import { Building2, ExternalLink, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

function MetaBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-foreground text-sm font-semibold">{label}</p>
      <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export default async function MarketplaceAppPage({ params }: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await params;

  const [app] = await retrieveApps({ slug: appSlug });

  if (!app) notFound();

  const worksWith = app.scopes.map((scope) => {
    if (scope === "*") return "All resources";
    const resource = scope.split(":")[1] as keyof typeof APP_CONFIG;
    return APP_CONFIG[resource]?.label ?? resource;
  });

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="w-full flex-1 px-5 py-8">
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

          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-4">
              {app.iconUrl ? (
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
              ) : (
                <div className="bg-foreground/5 border-border flex size-16 items-center justify-center rounded-lg border">
                  <Building2 className="size-6" />
                </div>
              )}
              <div className="min-w-0 space-y-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{app.name}</h1>
                <p className="text-muted-foreground max-w-xl text-base leading-relaxed">{app.tagline}</p>
              </div>
            </div>
            {app.status === "available" && (
              <div className="shrink-0 sm:pt-1">
                <InstallAppButton appName={app.name} appSlug={app.slug} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
            <aside className="w-full shrink-0 space-y-8 lg:max-w-xs">
              <MetaBlock label="Built by">{app.publisher}</MetaBlock>
              <MetaBlock label="Works with">
                <ul className="list-inside list-disc space-y-1">
                  {worksWith.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </MetaBlock>
              {app.price && <MetaBlock label="Pricing">{app.price}</MetaBlock>}
              {app.supportEmail && (
                <div className="space-y-1.5">
                  <p className="text-foreground text-sm font-semibold">Support</p>
                  <a
                    href={`mailto:${app.supportEmail}`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {app.supportEmail}
                  </a>
                </div>
              )}
              {app.websiteUrl && (
                <div className="space-y-1.5">
                  <p className="text-foreground text-sm font-semibold">Resources</p>
                  <a
                    href={app.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                  >
                    Company website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              <p className="text-muted-foreground/80 text-xs">
                <button type="button" className="underline-offset-4 hover:underline">
                  Report app to StellarTools
                </button>
              </p>
            </aside>

            <div className="min-w-0 flex-1 space-y-10">
              <Separator className="lg:hidden" />
              <div>
                <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest uppercase">About</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{app.featuresMarkdown}</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
