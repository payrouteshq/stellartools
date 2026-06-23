import { retrieveApps } from "@/actions/app";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Badge, Card, CardContent } from "@stellartools/shared-ui";
import { ArrowUpRight, Building2, ChevronRight, Construction } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default async function MarketplacePage() {
  const apps = await retrieveApps();

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                Connect the tools your team already uses directly to your StellarTools data. These integrations are
                actively being built — browse what&apos;s coming and get notified at launch.
              </p>
            </div>
            <a
              href={`${process.env.NEXT_PUBLIC_DOCS_URL}/marketplace/building-apps`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm underline-offset-4 hover:underline"
            >
              Build for the marketplace
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <Construction className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Marketplace is in development.</span> All integrations listed below are
              coming soon
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Link key={app.id} href={`/marketplace/${app.slug}`} className="group block">
                <Card className="border-border/80 hover:border-primary/30 h-full shadow-none transition-colors">
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex items-start gap-3">
                      {app?.iconUrl ? (
                        <div className="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border">
                          <Image
                            src={app.iconUrl}
                            alt={app.name}
                            width={56}
                            height={56}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="bg-foreground/5 border-border flex size-14 items-center justify-center rounded-lg border">
                          <Building2 className="size-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="group-hover:text-primary leading-snug font-semibold tracking-tight">
                            {app.name}
                          </h2>
                          <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">{app.tagline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="w-fit font-normal">
                        {app.publisher}
                      </Badge>
                      {app.status === "coming_soon" && (
                        <Badge variant="outline" className="text-muted-foreground w-fit font-normal">
                          Coming soon
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
