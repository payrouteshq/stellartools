"use client";

import * as React from "react";

import { cn, useIsMobile } from "@stellartools/shared-ui";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import Image from "next/image";

import { LoopsAppPanel } from "./loops-app-panel";
import { type MockInstalledApp, installedApps } from "./mock-data";
import { ResendAppPanel } from "./resend-app-panel";

export function InstalledAppsDock({
  activeAppId,
  onSelect,
}: {
  activeAppId: string | null;
  onSelect: (id: string) => void;
}) {
  const isMobile = useIsMobile();

  const icons = installedApps.map((app) => (
    <button
      key={app.id}
      onClick={() => onSelect(app.id)}
      title={app.name}
      className={cn(
        "bg-background relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md shadow-sm transition-shadow hover:shadow-md",
        activeAppId === app.id && "ring-primary shadow-md ring-2"
      )}
    >
      <Image src={app.iconUrl} alt={app.name} fill className="object-cover" unoptimized />
    </button>
  ));

  const addButton = (
    <button
      title="Browse the marketplace"
      className="bg-primary text-primary-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-sm transition-shadow hover:shadow-md"
    >
      <Plus className="size-4" />
    </button>
  );

  if (isMobile) {
    return (
      <div className="bg-background/95 absolute inset-x-0 bottom-0 z-40 flex h-14 items-center justify-center gap-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        {icons}
        {addButton}
      </div>
    );
  }

  return (
    <div className="absolute top-1/2 right-3 z-40 flex -translate-y-1/2 flex-col items-center gap-2">
      {icons}
      {addButton}
    </div>
  );
}

function useLaunching(appId: string | undefined) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!appId) return;
    setLoading(true);
    // Mirrors the brief loading window the real launcher has while it mints
    // a token before the app iframe is ready to render.
    const timer = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(timer);
  }, [appId]);

  return loading;
}

export function PluginLauncherDrawer({ app, onClose }: { app: MockInstalledApp | null; onClose: () => void }) {
  const loading = useLaunching(app?.id);

  return (
    <AnimatePresence>
      {app && (
        <React.Fragment key={app.id}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/30"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="bg-background absolute inset-y-0 right-0 z-50 flex w-[min(22rem,85%)] flex-col shadow-2xl"
          >
            <header className="flex items-center gap-3 p-4">
              <div className="relative size-9 shrink-0 overflow-hidden rounded-lg">
                <Image src={app.iconUrl} alt={app.name} fill className="object-cover" unoptimized />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{app.name}</p>
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span
                    className={cn(
                      "inline-block size-1.5 rounded-full",
                      app.slug === "loops" ? "bg-muted-foreground/40" : "bg-green-500"
                    )}
                  />
                  {app.slug === "loops" ? "Not connected" : app.connectedSince}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="bg-muted/60 h-40 animate-pulse rounded-md" />
              ) : app.slug === "resend" ? (
                <ResendAppPanel onDisconnect={onClose} />
              ) : (
                <LoopsAppPanel />
              )}
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
