"use client";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { capture } from "@/lib/posthog";

export function InstallAppButton({
  appName,
  appId,
  appCategory,
}: {
  appName: string;
  appId: string;
  appCategory: string;
}) {
  return (
    <Button
      className="shadow-none"
      onClick={() => {
        capture("marketplace_app_interest", {
          app_id: appId,
          app_name: appName,
          app_category: appCategory,
        });
        toast.success(`${appName} installation coming soon`);
      }}
    >
      Install app
    </Button>
  );
}
