"use client";

import * as React from "react";

import { retrieveInstalledApps } from "@/actions/app";
import { App, AppInstallation } from "@/db/schema";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";

export type InstalledApp = {
  installation: AppInstallation;
  app: App;
};

export function usePlugins() {
  const { data: org } = useOrgContext();

  const { data: installations = [], isLoading } = useOrgQuery(
    ["installed-apps"],
    async () => {
      const plugins = await retrieveInstalledApps({ status: "active" }, org?.id, org?.environment);
      return plugins.map((p) => ({
        installation: p.app_installation,
        app: p.app,
      }));
    },
    { enabled: !!org?.id }
  );

  const [activeAppId, setActiveAppId] = useCookieState<string | null>("active_plugin_id", null);
  const [isOpen, setIsOpen] = useCookieState<boolean>("plugin_sidebar_open", false);

  const activePlugin = React.useMemo(() => {
    if (!activeAppId) return installations[0] || null;
    return installations.find((i) => i.app.id === activeAppId) || installations[0] || null;
  }, [installations, activeAppId]);

  return {
    installations,
    activePlugin,
    isLoading,
    isOpen,
    setIsOpen,
    selectApp: (id: string) => {
      setActiveAppId(id);
      setIsOpen(true);
    },
    toggleSidebar: () => setIsOpen(!isOpen),
  };
}
