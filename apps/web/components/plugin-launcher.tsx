"use client";

import * as React from "react";

import { createPortal } from "react-dom";

import { deleteAppInstallation, generateAppToken } from "@/actions/app";
import { App, AppInstallation } from "@/db/schema";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useOrgContext } from "@/hooks/use-org-query";
import { AppModal, Button, Separator, cn, useMounted } from "@stellartools/shared-ui";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { PlusIcon, RotateCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface PluginLauncherProps {
  installationsWithApps: { installation: AppInstallation; app: App }[];
}

export function PluginLauncher({ installationsWithApps }: PluginLauncherProps) {
  const router = useRouter();
  const isMounted = useMounted();
  const { data: org } = useOrgContext();

  const queryClient = useQueryClient();

  const [period, setPeriod] = useCookieState("dashboard_period", "30");
  const { resolvedTheme } = useTheme();
  const [activeAppId, setActiveAppId] = useCookieState<string | null>("active_plugin_id", null);
  const [isOpen, setIsOpen] = useCookieState<boolean>("plugin_sidebar_open", false);

  const activePlugin = React.useMemo(() => {
    if (!activeAppId) return installationsWithApps?.[0] || null;
    return installationsWithApps?.find((i) => i.app.id === activeAppId) || installationsWithApps?.[0] || null;
  }, [installationsWithApps, activeAppId]);

  const [appToken, setAppToken] = React.useState<string | null>(null);
  const [tokenRefreshKey, setTokenRefreshKey] = React.useState(0);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteInstallation = async () => {
    if (!activePlugin?.installation.id) return;
    setIsDeleting(true);
    try {
      await deleteAppInstallation(activePlugin.installation.id, org?.id, org?.environment);
      setIsOpen(false);
      await queryClient.invalidateQueries();
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectApp = React.useCallback(
    (id: string) => {
      setActiveAppId(id);
      setIsOpen(true);
    },
    [setActiveAppId, setIsOpen]
  );

  React.useEffect(() => {
    const handler = (e: Event) => {
      const { appId } = (e as CustomEvent<{ appId: string }>).detail;
      handleSelectApp(appId);
    };
    window.addEventListener("stellartools:open-app", handler);
    return () => window.removeEventListener("stellartools:open-app", handler);
  }, [handleSelectApp]);

  React.useEffect(() => {
    const pendingAppId = sessionStorage.getItem("stellartools:pending-open-app");
    if (!pendingAppId) return;
    sessionStorage.removeItem("stellartools:pending-open-app");
    handleSelectApp(pendingAppId);
  }, [handleSelectApp]);

  React.useEffect(() => {
    const handler = (e: Event) => {
      setPeriod((e as CustomEvent<{ period: string }>).detail.period);
    };
    window.addEventListener("stellar:period-changed", handler);
    return () => window.removeEventListener("stellar:period-changed", handler);
  }, [setPeriod]);

  React.useEffect(() => {
    if (!activePlugin?.installation.id || !resolvedTheme) return;

    (async () => {
      const response = await generateAppToken(
        activePlugin.installation.id,
        {
          periodDays: Number(period),
          currency: org?.selectedCurrency ?? "USD",
          theme: resolvedTheme === "dark" ? "dark" : "light",
        },
        org?.id,
        org?.environment
      );

      setAppToken(response);
    })();
  }, [activePlugin?.installation.id, org?.selectedCurrency, period, resolvedTheme, tokenRefreshKey]);

  const src = React.useMemo(() => {
    if (!activePlugin?.app.baseUrl) return "";
    const url = new URL(activePlugin.app.baseUrl);
    if (appToken) url.searchParams.set("st_token", appToken);
    return url.toString();
  }, [activePlugin?.app.baseUrl, appToken]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!activePlugin?.app.baseUrl) return;
      if (new URL(activePlugin.app.baseUrl).origin !== event.origin) return;
      if (event.data.type === "stellar:data-changed") {
        queryClient.invalidateQueries();
        setTokenRefreshKey((k) => k + 1);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [activePlugin?.app.baseUrl, queryClient]);

  const drawerContent = (
    <>
      <div className="bg-muted/30 shrink-0 border-b">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {activePlugin?.app.iconUrl ? (
              <div className="border-border bg-background relative h-9 w-9 shrink-0 overflow-hidden rounded-none border shadow-sm">
                <Image
                  src={activePlugin.app.iconUrl}
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
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Delete installation"
              className="text-muted-foreground hover:text-destructive size-10 shrink-0"
              onClick={() =>
                AppModal.open({
                  title: `Delete ${activePlugin?.app.name ?? "app"} installation?`,
                  description:
                    "This removes the installation and its settings. This is different from disconnecting the app, which is done from inside the app itself. This action cannot be undone.",
                  content: null,
                  primaryButton: {
                    children: isDeleting ? "Deleting..." : "Delete",
                    onClick: handleDeleteInstallation,
                    variant: "destructive",
                    disabled: isDeleting,
                  },
                  secondaryButton: { children: "Cancel" },
                  size: "small",
                  showCloseButton: true,
                })
              }
            >
              <Trash2Icon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Reload app"
              className="text-muted-foreground hover:text-foreground size-10 shrink-0"
              onClick={() => setTokenRefreshKey((k) => k + 1)}
            >
              <RotateCwIcon className="size-4" />
            </Button>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {appToken && src ? (
          <iframe
            src={src}
            className="bg-background h-full w-full border-none transition-all duration-200"
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            allow="clipboard-write"
          />
        ) : (
          <div className="bg-muted/60 m-4 h-48 animate-pulse rounded-md border border-dashed" />
        )}
      </div>
    </>
  );

  const renderAppIcons = (isActiveFn: (id: string) => boolean) =>
    installationsWithApps?.map((installation) => {
      const active = isActiveFn(installation.app.id);
      return (
        <Button
          key={installation.app.id}
          onClick={() => (active ? setIsOpen(false) : handleSelectApp(installation.app.id))}
          title={installation.app.name}
          className={cn(
            "border-border bg-background relative size-8 cursor-pointer overflow-hidden rounded-none border p-0 shadow-sm transition-shadow hover:shadow-md",
            active && "ring-primary shadow-md ring-2"
          )}
        >
          <Image
            src={installation.app.iconUrl as string}
            alt={`${installation.app.name} on StellarTools`}
            fill
            className="rounded-sm object-cover"
            unoptimized
          />
        </Button>
      );
    });

  const portal = (
    <>
      {/* Desktop: vertical separator */}
      <Separator
        orientation="vertical"
        className="bg-border/70 pointer-events-none fixed inset-y-0 right-9 z-35 hidden h-full md:block"
      />

      {/* Desktop: right-side vertical icon strip */}
      <div className="fixed top-1/2 -right-3 z-40 hidden -translate-y-1/2 items-center gap-3 pr-3 font-sans md:flex">
        <div className="flex flex-col items-end gap-2.5">
          {renderAppIcons((id) => activePlugin?.app.id === id && isOpen)}
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

      {/* Mobile: bottom icon bar */}
      <div className="md:hidden">
        <div className="bg-background fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-center gap-2.5 border-t px-4">
          {renderAppIcons((id) => activePlugin?.app.id === id && isOpen)}
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

      {/* Desktop drawer: slides in from right */}
      <div className="hidden md:block">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="plugin-drawer-desktop"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%", transition: { type: "tween", ease: "easeIn", duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="bg-background border-border/80 fixed inset-y-0 right-12 z-40 flex h-full w-[min(32rem,calc(100vw-3rem))] flex-col border-l font-sans shadow-2xl"
              role="complementary"
              aria-label={activePlugin?.app.name ?? "Installed app"}
            >
              {drawerContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile drawer: bottom sheet, slides up */}
      <div className="md:hidden">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="plugin-drawer-mobile"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%", transition: { type: "tween", ease: "easeIn", duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="bg-background border-border/80 fixed inset-x-5 bottom-12 z-40 flex h-[70vh] flex-col rounded-t-2xl border border-b-0 font-sans shadow-2xl"
              role="complementary"
              aria-label={activePlugin?.app.name ?? "Installed app"}
            >
              {drawerContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  return isMounted ? createPortal(portal, document.body) : null;
}
