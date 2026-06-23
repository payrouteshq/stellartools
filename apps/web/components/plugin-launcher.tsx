"use client";

import * as React from "react";

import { createPortal } from "react-dom";

import { generateAppToken, retrieveInstalledApps } from "@/actions/app";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { Button, Separator, Spinner } from "@stellartools/shared-ui";
import { cn, useMounted } from "@stellartools/shared-ui";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export function PluginLauncher() {
  const router = useRouter();
  const isMounted = useMounted();
  const { data: org } = useOrgContext();
  const { data: installations, isLoading: isLoadingInstalledApps } = useOrgQuery(["installed-apps"], async () => {
    const installations = await retrieveInstalledApps({ status: "active" }, org?.id, org?.environment);
    return installations.map((p) => ({
      installation: p.app_installation,
      app: p.app,
    }));
  });

  const queryClient = useQueryClient();

  const [period] = useCookieState("dashboard_period", "30");
  const [activeAppId, setActiveAppId] = useCookieState<string | null>("active_plugin_id", null);
  const [isOpen, setIsOpen] = useCookieState<boolean>("plugin_sidebar_open", false);

  const activePlugin = React.useMemo(() => {
    if (!activeAppId) return installations?.[0] || null;
    return installations?.find((i) => i.app.id === activeAppId) || installations?.[0] || null;
  }, [installations, activeAppId]);

  const [appToken, setAppToken] = React.useState<string | null>(null);

  const handleSelectApp = React.useCallback(
    (id: string) => {
      setActiveAppId(id);
      setIsOpen(true);
    },
    [setActiveAppId, setIsOpen]
  );

  React.useEffect(() => {
    if (!activePlugin?.installation.id) return;
    setAppToken(null);
    generateAppToken(activePlugin.installation.id, {
      periodDays: Number(period),
      currency: org?.selectedCurrency ?? "USD",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    }).then((token) => setAppToken(token));
  }, [activePlugin?.installation.id, org?.selectedCurrency, period]);

  const src = React.useMemo(() => {
    if (!activePlugin?.app.baseUrl) throw new Error("App base URL not found");
    const url = new URL(activePlugin.app.baseUrl);
    if (appToken) url.searchParams.set("st_token", appToken);
    return url.toString();
  }, [activePlugin?.app.baseUrl, appToken]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!activePlugin?.app.baseUrl) return;

      if (new URL(activePlugin.app.baseUrl).origin !== event.origin) return;

      if (event.data.type === "stellar:data-changed") {
        // Refresh EVERYTHING in the dashboard.
        // Tables, stats, and headers will update to reflect the App's changes.
        queryClient.invalidateQueries();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [activePlugin?.app.baseUrl, queryClient]);

  if (process.env.NEXT_PUBLIC_SHOW_MARKETPLACE_LAUNCHER === "false") return null;

  const portal = (
    <>
      <Separator
        orientation="vertical"
        className="bg-border/70 pointer-events-none fixed inset-y-0 right-9 z-110 h-full"
      />

      <div className="fixed top-1/2 -right-3 z-120 flex -translate-y-1/2 items-center gap-3 pr-3 font-sans">
        {isLoadingInstalledApps && <Spinner size={24} />}
        <div className="flex flex-col items-end gap-2.5">
          {installations?.map((installation) => {
            const isActive = activePlugin?.app.id === installation.app.id && isOpen;

            return (
              <Button
                key={installation.app.id}
                onClick={() => (isActive ? setIsOpen(false) : handleSelectApp(installation.app.id))}
                title={installation.app.name}
                className={cn(
                  "border-border bg-background relative size-8 cursor-pointer overflow-hidden rounded-none border p-0 shadow-sm transition-shadow hover:shadow-md",
                  isActive && "ring-primary shadow-md ring-2"
                )}
              >
                <Image
                  src={installation.app.manifest?.iconUrl as string}
                  alt={`${installation.app.name} on StellarTools`}
                  fill
                  className="rounded-sm object-cover"
                  unoptimized
                />
              </Button>
            );
          })}

          <Button
            type="button"
            size="icon"
            title="Browse marketplace"
            className="bg-primary text-primary-foreground hover:bg-primary/90 size-8 rounded-full border shadow-sm transition-shadow hover:shadow-md"
            onClick={() => router.push(`/marketplace`)}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="plugin-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%", transition: { type: "tween", ease: "easeIn", duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="bg-background border-border/80 fixed inset-y-0 right-12 z-100 flex h-full w-[min(32rem,calc(100vw-3rem))] flex-col border-l font-sans shadow-2xl"
            role="complementary"
            aria-label={activePlugin?.app.name ?? "Installed app"}
          >
            <div className="bg-muted/30 shrink-0 border-b">
              <div className="bg-primary h-0.5 w-full" />
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  {activePlugin?.app.manifest?.iconUrl ? (
                    <div className="border-border bg-background relative h-9 w-9 shrink-0 overflow-hidden rounded-none border shadow-sm">
                      <Image
                        src={activePlugin.app.manifest.iconUrl}
                        alt=""
                        fill
                        className="rounded-sm object-cover"
                        draggable={false}
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[11px] font-medium tracking-[0.16em] uppercase">
                      {activePlugin?.app.name ?? "Installed app"}
                    </p>
                    <p className="text-foreground truncate text-sm font-semibold tracking-tight">Integration</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground size-10 shrink-0"
                  onClick={() => setIsOpen(false)}
                >
                  <XIcon className="size-5" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {activePlugin?.app?.baseUrl ? (
                <iframe
                  src={src}
                  className="w-full border-none transition-all duration-200"
                  style={{ height: `100%` }}
                  sandbox="allow-scripts allow-forms allow-popups allow-same-origin bg-background w-full border-none"
                />
              ) : (
                <div className="bg-muted/60 m-4 h-48 animate-pulse rounded-md border border-dashed" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return isMounted ? createPortal(portal, document.body) : null;
}
