"use client";

import * as React from "react";

import { installMarketplaceApp, retrieveInstalledApps } from "@/actions/app";
import { useInvalidateOrgQuery, useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { capture } from "@/lib/posthog";
import { Button, toast } from "@stellartools/shared-ui";

export function InstallAppButton({
  appName,
  appSlug,
  appCategory,
}: {
  appName: string;
  appSlug: string;
  appCategory?: string;
}) {
  const invalidate = useInvalidateOrgQuery();
  const [pending, setPending] = React.useState(false);

  const { data: org } = useOrgContext();
  const { data: installations } = useOrgQuery(["installed-apps"], async () => {
    const installations = await retrieveInstalledApps({ status: "active" }, org?.id, org?.environment);
    return installations.map((p) => ({
      installation: p.app_installation,
      app: p.app,
    }));
  });

  const installedApp = installations?.find((installation) => installation.app.slug === appSlug);

  const openApp = React.useCallback((appId: string) => {
    window.dispatchEvent(new CustomEvent("stellartools:open-app", { detail: { appId } }));
  }, []);

  const handleClick = async () => {
    if (installedApp) {
      openApp(installedApp.app.id);
      return;
    }

    setPending(true);

    try {
      const result = await installMarketplaceApp(appSlug);

      capture("marketplace_app_installed", {
        app_slug: appSlug,
        app_name: appName,
        app_category: appCategory,
      });

      await invalidate(["installed-apps"]);

      openApp(result.app.id);

      toast.success(`${appName} installed successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to install app");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button className="shadow-none" onClick={handleClick} disabled={pending}>
      {pending ? "Installing…" : installedApp ? "Open app" : "Install app"}
    </Button>
  );
}
