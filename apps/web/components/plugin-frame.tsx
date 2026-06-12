"use client";

import * as React from "react";

import { useInvalidateOrgQuery, useOrgContext } from "@/hooks/use-org-query";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";

interface PluginFrameProps extends React.ComponentProps<"iframe"> {
  appBaseUrl: string;
  installationId: string;
}

export function PluginFrame({ appBaseUrl, installationId, ...forwardedProps }: PluginFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { data: org } = useOrgContext();
  const invalidate = useInvalidateOrgQuery();
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState(150);

  // 1. Build initial URL (The Handshake)
  const src = React.useMemo(() => {
    const url = new URL(appBaseUrl);
    url.searchParams.set("orgId", org!.id);
    url.searchParams.set("env", org!.environment);
    url.searchParams.set("theme", theme === "dark" ? "dark" : "light");
    url.searchParams.set("pathname", pathname);
    url.searchParams.set("instId", installationId);
    return url.toString();
  }, [appBaseUrl, org, installationId]); // excludes pathname/theme to prevent iframe reloads

  React.useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      {
        type: "stellar:context_update",
        payload: { pathname, theme },
      },
      "*"
    );
  }, [pathname, theme]);

  React.useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.origin !== new URL(appBaseUrl).origin) return;

      const { type, payload } = event.data;
      switch (type) {
        case "stellar:resize":
          setHeight(payload.height);
          break;
        case "stellar:navigate":
          router.push(payload.url);
          break;
        case "stellar:reload":
          await invalidate(["*"]);
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [appBaseUrl, router, invalidate]);

  return (
    <iframe
      {...forwardedProps}
      ref={frameRef}
      src={src}
      className={cn("w-full border-none transition-all duration-200", forwardedProps.className)}
      style={{ height: `${height}px`, overflow: "hidden" }}
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
    />
  );
}
