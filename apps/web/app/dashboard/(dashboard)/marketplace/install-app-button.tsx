"use client";

import { useState } from "react";

import { installMarketplaceApp } from "@/actions/app";
import { useInvalidateOrgQuery } from "@/hooks/use-org-query";
import { usePlugins } from "@/hooks/use-plugin";
import { capture } from "@/lib/posthog";
import { Button, toast } from "@stellartools/shared-ui";
import { useRouter } from "next/navigation";

export function InstallAppButton({
  appName,
  appId,
  appCategory,
}: {
  appName: string;
  appId: string;
  appCategory: string;
}) {
  const router = useRouter();
  const invalidate = useInvalidateOrgQuery();
  const { installations, selectApp } = usePlugins();
  const [pending, setPending] = useState(false);

  const installedApp = installations.find((installation) => installation.app.slug === appId);

  const handleClick = async () => {
    if (installedApp) {
      selectApp(installedApp.app.id);
      router.push("/");
      return;
    }

    setPending(true);

    try {
      const result = await installMarketplaceApp(appId);

      capture("marketplace_app_installed", {
        app_id: appId,
        app_name: appName,
        app_category: appCategory,
        already_installed: result.alreadyInstalled,
      });

      await invalidate(["installed-apps"]);
      selectApp(result.app.id);
      router.push("/");

      toast.success(result.alreadyInstalled ? `${appName} is already installed` : `${appName} installed successfully`);
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
