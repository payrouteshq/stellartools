"use client";

import { capture } from "@/lib/posthog";
import { Button, toast } from "@stellartools/shared-ui";

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
