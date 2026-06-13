"use client";

import * as React from "react";

import { resendWebhookLog, retrieveWebhookLogs } from "@/actions/webhook";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { WebhookLog } from "@/db";
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
  useCopy,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Clock, Copy, RefreshCw, XCircle } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const StatusBadge = ({ statusCode, nextRetry }: { statusCode?: number; nextRetry?: string }) => {
  if (statusCode === 200) {
    return (
      <Badge
        variant="outline"
        className="w-[90px] justify-center gap-1.5 border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
      >
        <CheckMark2 width={16} height={16} className="text-green-600" />
        200 OK
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="w-[90px] justify-center gap-1.5 border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400"
    >
      {nextRetry ? <Clock className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      Failed
    </Badge>
  );
};

const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const { copied, handleCopy } = useCopy();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-8 w-8"
      onClick={() => handleCopy({ text, message: "Copied to clipboard" })}
      title={label || "Copy to clipboard"}
    >
      {copied ? <CheckMark2 width={16} height={16} className="text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
};

const columns: ColumnDef<WebhookLog>[] = [
  {
    accessorKey: "status",
    header: () => null,
    cell: ({ row }) => {
      const log = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <StatusBadge
              statusCode={log.statusCode ?? undefined}
              nextRetry={log.nextRetry ? moment(log.nextRetry).fromNow() : undefined}
            />
          </div>
          <span className="text-sm font-medium">{log.eventType}</span>
        </div>
      );
    },
    size: 1000,
  },
  {
    accessorKey: "timestamp",
    header: () => null,
    cell: ({ row }) => {
      const log = row.original;
      return (
        <div className="text-right whitespace-nowrap">
          <span className="text-muted-foreground text-sm">
            {moment(log.createdAt).utc().format("MMM D, YYYY, h:mm A [GMT]")}
          </span>
        </div>
      );
    },
    size: 150,
  },
];

// --- Main Component ---

export default function WebhookLogPage() {
  const params = useParams();
  const webhookId = params?.id as string;
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const [searchQuery, _] = React.useState("");
  const [statusFilter, setStatusFilter] = useCookieState("webhook_status_filter", "all");

  const {
    data: webhookLogs,
    isLoading: isLoadingWebhookLogs,
    refetch: refetchWebhookLogs,
  } = useOrgQuery(
    ["webhookLogs", webhookId],
    () => retrieveWebhookLogs(webhookId, undefined, undefined, { appInstallationId: undefined }),
    {
      enabled: !!webhookId,
      select: (data) => {
        return data.map((log) => ({
          id: log.id,
          eventType: log.eventType,
          status: log.statusCode === 200 ? ("succeeded" as const) : ("failed" as const),
          statusCode: log.statusCode ?? undefined,
          timestamp: new Date(log.createdAt),
          eventId: log.id,
          originDate: new Date(log.createdAt),
          source: "Automatic",
          apiVersion: log.apiVersion,
          description: log.description,
          response: log.response ?? undefined,
          request: log.request ?? {},
          nextRetry: log.nextRetry ? moment(log.nextRetry).fromNow() : undefined,
        }));
      },
    }
  );

  const { mutate: resendWebhookLogAction, isPending: isResendingWebhookLog } = useAction(
    async ({ eventType, payload }: { eventType: WebhookEventType; payload: WebhookEvent }) =>
      resendWebhookLog(webhookId, eventType, payload),
    {
      onSuccess: () => refetchWebhookLogs(),
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

  const filteredLogs = React.useMemo(() => {
    let logs = webhookLogs;

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
  }, [webhookLogs, searchQuery, statusFilter, eventId]);

  const renderDetail = (log: WebhookLog) => {
    return (
      <div className="flex h-full flex-col">
        <div className="border-border mb-4 flex items-start justify-between border-b pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Delivery attempt</h3>
            <p className="text-muted-foreground text-sm">{log.eventType}</p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              resendWebhookLogAction({
                eventType: log.eventType as WebhookEventType,
                payload: getResendPayload(log) as WebhookEvent,
              })
            }
            disabled={isResendingWebhookLog}
            isLoading={isResendingWebhookLog}
          >
            Resend
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          <LogDetailSection title="Delivery status">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm font-medium">Delivery status</span>
                <div className="flex shrink-0 items-center gap-2">
                  {log.statusCode === 200 ? (
                    <Badge
                      variant="outline"
                      className="w-[90px] justify-center gap-1.5 border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
                    >
                      <CheckMark2 width={16} height={16} className="text-green-600" />
                      200 OK
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="w-[90px] justify-center gap-1.5 border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400"
                    >
                      <XCircle className="h-3 w-3" />
                      Failed
                    </Badge>
                  )}
                  {log.nextRetry && (
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      Next retry in {moment(log.nextRetry).fromNow()}
                    </span>
                  )}
                </div>
              </div>

              <LogDetailItem
                label="Attempt date"
                value={moment(log.createdAt).utc().format("MMM D, YYYY, h:mm A [GMT]")}
              />

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <LogDetailItem
                    label="Event ID"
                    value={
                      <Link href="#" className="text-primary hover:underline">
                        {log.id}
                      </Link>
                    }
                  />
                </div>
                <div className="flex items-center pt-4">
                  <CopyButton text={log.id} label="Copy event ID" />
                </div>
              </div>

              <LogDetailItem
                label="Origin date"
                value={moment(log.createdAt).utc().format("MMM D, YYYY, h:mm A [GMT]")}
              />

              <LogDetailItem label="Source" value="Automatic" />
              <LogDetailItem label="API version" value={log.apiVersion} />
              <LogDetailItem label="Description" value={log.description} />
            </div>
          </LogDetailSection>

          <LogDetailSection title="Response">
            {log.response ? (
              <CodeBlock language="json" showCopyButton={true} maxHeight="200px">
                {typeof log.response === "string" ? log.response : JSON.stringify(log.response, null, 2)}
              </CodeBlock>
            ) : (
              <p className="text-muted-foreground text-sm">No data</p>
            )}
          </LogDetailSection>

          <LogDetailSection title="Request">
            <CodeBlock language="json" showCopyButton={true} maxHeight="400px">
              {JSON.stringify(log.request, null, 2)}
            </CodeBlock>
          </LogDetailSection>
        </div>

        <div className="border-border mt-4 border-t pt-4">
          <p className="text-muted-foreground text-center text-xs">Resent automatically</p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-6">
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

            <div className="flex items-center justify-between" />

            <div className="flex items-center justify-between gap-4">
              <UnderlineTabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
                <UnderlineTabsList>
                  <UnderlineTabsTrigger value="all">All</UnderlineTabsTrigger>
                  <UnderlineTabsTrigger value="succeeded">Succeeded</UnderlineTabsTrigger>
                  <UnderlineTabsTrigger value="failed">Failed</UnderlineTabsTrigger>
                </UnderlineTabsList>
              </UnderlineTabs>
              <Button variant="outline" size="sm" className="cursor-pointer gap-2" onClick={() => refetchWebhookLogs()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="text-muted-foreground flex items-center justify-end text-sm">
              <div>Updated today {moment().format("h:mm:ss A")} IST</div>
            </div>

            <div className="h-[calc(100vh-400px)] min-h-[600px]">
              <Log
                data={filteredLogs as unknown as WebhookLog[]}
                columns={columns}
                renderDetail={renderDetail}
                detailPanelWidth={500}
                emptyMessage="No logs found"
                className="h-full"
                isLoading={isLoadingWebhookLogs}
                defaultSelected={eventId ? (filteredLogs[0] as any | undefined) : undefined}
              />
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
