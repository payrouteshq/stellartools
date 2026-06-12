"use client";

import { retrieveWebhooks } from "@/actions/webhook";
import { AmbiguityGuard } from "@/components/ambiguity-guard";
import { useOrgQuery } from "@/hooks/use-org-query";

export default function WebhookSelectorPage() {
  const { data: webhooks = [], isLoading } = useOrgQuery(["webhooks"], () => retrieveWebhooks());

  const columns = [
    { accessorKey: "name", header: "WEBHOOK NAME" },
    {
      accessorKey: "url",
      header: "ENDPOINT",
      cell: ({ row }: any) => <code className="text-xs">{row.original.url}</code>,
    },
  ];

  return (
    <AmbiguityGuard
      title="Select a webhook endpoint"
      description="You have multiple endpoints. Choose one to view the specific event delivery."
      items={webhooks}
      isLoading={isLoading}
      columns={columns}
      resolveTo={(wh) => `/webhooks/${wh.id}`}
    />
  );
}
