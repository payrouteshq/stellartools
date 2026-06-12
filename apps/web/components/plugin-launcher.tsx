"use client";

import { createPortal } from "react-dom";

import { PluginFrame } from "@/components/plugin-frame";
import { useMounted } from "@/hooks/use-mounted";
import { usePlugins } from "@/hooks/use-plugin";
import { cn } from "@/lib/utils";
import { Button, Separator } from "@stellartools/shared-ui";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@stellartools/shared-ui";
import { PlusIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export function PluginLauncher() {
  const router = useRouter();
  const isMounted = useMounted();
  const { activePlugin, isOpen, selectApp, setIsOpen, installations } = usePlugins();

  if (process.env.NEXT_PUBLIC_SHOW_MARKETPLACE_LAUNCHER === "false") return null;

  const launcher = (
    <>
      <Separator
        orientation="vertical"
        className="bg-foreground/20 pointer-events-none fixed inset-y-0 right-8 z-110 h-full"
      />

      <div className="fixed top-1/2 -right-3 z-120 flex -translate-y-1/2 items-center gap-3 pr-3">
        <div className="flex flex-col items-end gap-3">
          {installations.map((installation) => (
            <Button
              key={installation.app.id}
              onClick={() => selectApp(installation.app.id)}
              className={cn(
                "size-7 rounded-full border shadow-lg",
                activePlugin.app.id === installation.app.id ? "bg-white shadow-sm" : "opacity-50"
              )}
            >
              <Image
                src={installation.app.manifest?.iconUrl as string}
                alt={`${installation.app.name} on StellarTools`}
                fill
                className="object-cover"
              />
            </Button>
          ))}

          <Button
            type="button"
            size="icon"
            className="bg-primary text-primary-foreground size-7 rounded-full border shadow-lg"
            onClick={() => router.push(`/marketplace`)}
          >
            <PlusIcon className="size-5 transition-transform" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {isMounted ? createPortal(launcher, document.body) : null}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>Integration Preview</SheetTitle>
            <SheetDescription>Dummy plugin frame for flow testing.</SheetDescription>
          </SheetHeader>
          <div className="p-4">
            {activePlugin?.app?.baseUrl ? (
              <PluginFrame
                appBaseUrl={activePlugin.app.baseUrl}
                installationId={activePlugin?.installation.id}
                title="Integration Preview"
                className="bg-background rounded-md border"
              />
            ) : (
              <div className="bg-muted h-32 animate-pulse rounded-md border" />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
