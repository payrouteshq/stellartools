"use client";

import * as React from "react";

import { resendDeliveryLog, retrieveDeliveryLogs as retrieveWebhookDeliveryLogs } from "@/actions/webhook";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { DeliveryLog } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useOrgQuery } from "@/hooks/use-org-query";
import type { WebhookEvent, WebhookEventType } from "@stellartools/core";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  CodeBlock,
  Log,
  LogDetailItem,
  LogDetailSection,
  UnderlineTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  cn,
  useCopy,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Copy, RefreshCw, XCircle } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const StatusDot = ({ ok }: { ok: boolean }) => (
  <span className={cn("inline-flex h-2 w-2 shrink-0 rounded-full", ok ? "bg-accent-foreground" : "bg-destructive")} />
);

const StatusCodeChip = ({ code }: { code?: number }) => {
  if (!code) return <span className="text-muted-foreground font-mono text-xs">—</span>;
  const ok = code < 400;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums",
        ok
          ? "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
          : "bg-destructive/10 text-destructive border-red-500/20"
      )}
    >
      {code}
    </span>
  );
};

const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const { copied, handleCopy } = useCopy();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-7 w-7"
      onClick={() => handleCopy({ text, message: "Copied to clipboard" })}
      title={label || "Copy to clipboard"}
    >
      {copied ? <CheckMark2 width={14} height={14} className="text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
};

const columns: ColumnDef<DeliveryLog>[] = [
  {
    id: "indicator",
    header: () => null,
    cell: ({ row }) => {
      const log = row.original as any;
      return <StatusDot ok={(log.statusCode ?? 0) < 400 && (log.statusCode ?? 0) !== 0} />;
    },
    size: 28,
  },
  {
    accessorKey: "status",
    header: () => null,
    cell: ({ row }) => {
      const log = row.original as any;
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-mono text-sm font-medium">{log.eventType}</span>
          <span className="text-muted-foreground text-xs">{log.source ?? "Automatic"}</span>
        </div>
      );
    },
    size: 9999,
  },
  {
    id: "code",
    header: () => null,
    cell: ({ row }) => {
      const log = row.original as any;
      return <StatusCodeChip code={log.statusCode} />;
    },
    size: 58,
  },
  {
    id: "responseTime",
    header: () => null,
    cell: ({ row }) => {
      const log = row.original as any;
      const ms = log.responseTime;
      return (
        <span className="text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums">
          {ms != null ? `${ms}ms` : "—"}
        </span>
      );
    },
    size: 68,
  },
  {
    accessorKey: "timestamp",
    header: () => null,
    cell: ({ row }) => {
      const log = row.original as any;
      return (
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {moment(log.createdAt).utc().format("MMM D, h:mm A")}
        </span>
      );
    },
    size: 120,
  },
];

// --- Main Component ---

export default function DeliveryLogPage() {
  const { webhookId } = useParams() as { webhookId: string };
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const [searchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = useCookieState("webhook_status_filter", "all");

  const {
    data: deliveryLogs,
    isLoading: isLoadingWebhookDeliveryLogs,
    refetch: refetchWebhookDeliveryLogs,
  } = useOrgQuery(
    ["deliveryLogs", webhookId],
    () => retrieveWebhookDeliveryLogs(webhookId, undefined, undefined, { appInstallationId: undefined }),
    {
      enabled: !!webhookId,
      select: (data) => {
        return data.map((log) => ({
          id: log.id,
          eventType: log.eventType,
          status: log.statusCode === 200 ? ("succeeded" as const) : ("failed" as const),
          statusCode: log.statusCode ?? undefined,
          createdAt: log.createdAt,
          timestamp: new Date(log.createdAt),
          eventId: log.id,
          originDate: new Date(log.createdAt),
          source: "Automatic",
          apiVersion: log.apiVersion,
          description: log.description,
          response: log.response ?? undefined,
          request: log.request ?? {},
          nextRetry: log.nextRetry ? moment(log.nextRetry).fromNow() : undefined,
          responseTime: log.responseTime ?? null,
        }));
      },
    }
  );

  const { mutate: resendDeliveryLogAction, isPending: isResendingDeliveryLog } = useAction(
    async ({ eventType, payload }: { eventType: WebhookEventType; payload: WebhookEvent }) =>
      resendDeliveryLog({ webhookId }, eventType, payload),
    {
      onSuccess: () => refetchWebhookDeliveryLogs(),
      errorMsg: "Failed to resend webhook",
      successMsg: "Webhook resent successfully",
    }
  );

  const getResendPayload = (log: { request?: unknown }): WebhookEvent => {
    const req = log.request;
    if (req && typeof req === "object" && "data" in req && req.data && typeof req.data === "object") {
      return req.data as WebhookEvent;
    }
    return (req as WebhookEvent) ?? {};
  };

  const counts = React.useMemo(() => {
    const all = deliveryLogs ?? [];
    return {
      all: all.length,
      succeeded: all.filter((l) => l.status === "succeeded").length,
      failed: all.filter((l) => l.status === "failed").length,
    };
  }, [deliveryLogs]);

  const filteredLogs = React.useMemo(() => {
    let logs = deliveryLogs;

    if (eventId && logs) {
      const targetLog = logs.find((l) => l.id === eventId);
      if (targetLog) return [targetLog];
    }

    if (searchQuery) {
      logs = logs?.filter(
        (log) =>
          log.eventId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.eventType.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter && statusFilter !== "all") {
      logs = logs?.filter((log) => log.status === statusFilter);
    }

    return logs ?? [];
  }, [deliveryLogs, searchQuery, statusFilter, eventId]);

  const renderDetail = (log: DeliveryLog) => {
    const l = log as any;
    const ok = (l.statusCode ?? 0) === 200;
    return (
      <div className="flex h-full flex-col">
        <div className="border-border mb-4 flex items-start justify-between border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusDot ok={ok} />
              <h3 className="font-semibold">{l.eventType}</h3>
            </div>
            <p className="text-muted-foreground text-xs">
              {moment(l.createdAt).utc().format("MMM D, YYYY [·] h:mm:ss A [GMT]")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              resendDeliveryLogAction({
                eventType: l.eventType as WebhookEventType,
                payload: getResendPayload(l) as WebhookEvent,
              })
            }
            disabled={isResendingDeliveryLog}
            isLoading={isResendingDeliveryLog}
          >
            Resend
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          <LogDetailSection title="Delivery">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">Status</span>
                <div className="flex items-center gap-2">
                  <StatusCodeChip code={l.statusCode} />
                  {l.nextRetry && <span className="text-muted-foreground text-xs">retry {l.nextRetry}</span>}
                </div>
              </div>
              {l.responseTime != null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Response time</span>
                  <span className="font-mono text-xs">{l.responseTime}ms</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-medium">Event ID</span>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="max-w-[180px] truncate font-mono text-xs">{l.id}</span>
                  <CopyButton text={l.id} label="Copy event ID" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">API version</span>
                <span className="font-mono text-xs">{l.apiVersion}</span>
              </div>
              {l.description && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">Description</span>
                  <span className="text-xs">{l.description}</span>
                </div>
              )}
            </div>
          </LogDetailSection>

          {l.response && (
            <LogDetailSection title="Response">
              <CodeBlock language="json" showCopyButton maxHeight="180px">
                {typeof l.response === "string" ? l.response : JSON.stringify(l.response, null, 2)}
              </CodeBlock>
            </LogDetailSection>
          )}

          <LogDetailSection title="Request">
            <CodeBlock language="json" showCopyButton maxHeight="320px">
              {JSON.stringify(l.request, null, 2)}
            </CodeBlock>
          </LogDetailSection>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-5 p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/webhooks">Webhooks</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>Logs</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {!isLoadingWebhookDeliveryLogs && counts.all > 0 && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold tabular-nums">{counts.all}</span>
                  <span className="text-muted-foreground text-sm">total</span>
                </div>
                <div className="bg-border h-4 w-px" />
                <div className="flex items-center gap-1.5">
                  <span className="bg-accent-foreground h-2 w-2 rounded-full" />
                  <span className="text-sm font-medium tabular-nums">{counts.succeeded}</span>
                  <span className="text-muted-foreground text-sm">succeeded</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-destructive h-2 w-2 rounded-full" />
                  <span className="text-sm font-medium tabular-nums">{counts.failed}</span>
                  <span className="text-muted-foreground text-sm">failed</span>
                </div>
              </div>
            )}

            {/* Filter + actions row */}
            <div className="flex items-center justify-between gap-4">
              <UnderlineTabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
                <UnderlineTabsList>
                  <UnderlineTabsTrigger value="all">
                    All
                    {counts.all > 0 && (
                      <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">{counts.all}</span>
                    )}
                  </UnderlineTabsTrigger>
                  <UnderlineTabsTrigger value="succeeded">
                    Succeeded
                    {counts.succeeded > 0 && (
                      <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">{counts.succeeded}</span>
                    )}
                  </UnderlineTabsTrigger>
                  <UnderlineTabsTrigger value="failed">
                    Failed
                    {counts.failed > 0 && (
                      <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">{counts.failed}</span>
                    )}
                  </UnderlineTabsTrigger>
                </UnderlineTabsList>
              </UnderlineTabs>

              <div className="flex items-center gap-3">
                <span className="text-muted-foreground hidden text-xs sm:block">
                  Updated {moment().format("h:mm:ss A")}
                </span>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetchWebhookDeliveryLogs()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="h-[calc(100vh-340px)] min-h-[480px]">
              <Log
                data={filteredLogs as unknown as DeliveryLog[]}
                columns={columns}
                renderDetail={renderDetail}
                detailPanelWidth={440}
                emptyMessage="No logs found"
                className="h-full"
                isLoading={isLoadingWebhookDeliveryLogs}
                defaultSelected={eventId ? (filteredLogs[0] as any | undefined) : undefined}
              />
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
