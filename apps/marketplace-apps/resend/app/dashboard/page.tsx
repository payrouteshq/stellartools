"use client";

import * as React from "react";

import { retrieveEmailStats, retrieveEmailTemplates, updateSettings } from "@/app/actions/resend";
import { EmailStats } from "@/app/types";
import { useStellarToolsContext, useStellarToolsMutation, useStellarToolsQuery } from "@stellartools/app-sdk";
import { AppInstallationSettingValue, WEBHOOK_EVENT_TYPES, WebhookEventType } from "@stellartools/core";
import {
  Badge,
  DataTable,
  Input,
  LineChart,
  SelectField,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stellartools/shared-ui";
import { useSearchParams } from "next/navigation";

type EmailRow = { original: EmailStats["emails"][number] };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  delivered: "default",
  opened: "secondary",
  sent: "outline",
  bounced: "destructive",
};

const EMAIL_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "delivered", label: "Delivered" },
  { value: "bounced", label: "Bounced" },
  { value: "opened", label: "Opened" },
  { value: "sent", label: "Sent" },
];

const EMAIL_COLUMNS = [
  { accessorKey: "to", header: "Recipient", enableSorting: true },
  { accessorKey: "subject", header: "Subject", enableSorting: true },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: EmailRow }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"} className="capitalize shadow-none">
        {row.original.status}
      </Badge>
    ),
    enableSorting: true,
  },
  { accessorKey: "sentAt", header: "Sent at", enableSorting: true },
];

const SEND_ACTIVITY_CONFIG = { sent: { label: "Emails sent", color: "var(--chart-1)" } };

const Dashboard = () => {
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token") ?? "";

  const { settings, orgId, ui } = useStellarToolsContext();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const { data: stats } = useStellarToolsQuery<EmailStats>(
    ["stats"],
    () => retrieveEmailStats(settings.resendApiKey as string, orgId, ui.periodDays),
    { enabled: !!settings.resendApiKey }
  );

  const { data: templates = [], isLoading: templatesLoading } = useStellarToolsQuery<
    Array<{ id: string; name: string }>
  >(["templates"], () => retrieveEmailTemplates(settings.resendApiKey as string), {
    enabled: !!settings.resendApiKey,
  });

  const { mutate: patchSettings, isPending: isSaving } = useStellarToolsMutation(
    async (patch: Record<string, AppInstallationSettingValue>) => {
      return await updateSettings(appToken, patch);
    }
  );

  const customerSyncEnabled = Boolean(settings.customerSyncEnabled);

  const templateOptions = React.useMemo(
    () => [{ value: "__none__", label: "None" }, ...templates.map((t) => ({ value: t.id, label: t.name }))],
    [templates]
  );

  const filteredEmails = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stats?.emails ?? []).filter(
      (item) =>
        (!q || item.to.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)) &&
        (statusFilter === "all" || item.status === statusFilter)
    );
  }, [stats, search, statusFilter]);

  const handleTemplateChange = (event: WebhookEventType, value: string) => {
    patchSettings({ [`${event}.templateId`]: value === "__none__" ? null : value });
  };

  const handleToggleSync = (enabled: boolean) => {
    patchSettings({ customerSyncEnabled: enabled });
  };

  return (
    <div className="bg-background min-h-screen px-5 pb-8">
      <section className="flex flex-col gap-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">Overview</h2>
            <p className="text-muted-foreground text-sm">Email delivery for the last {ui.periodDays} days</p>
          </div>
          <a
            href="https://resend.com/emails"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Go to Resend dashboard ↗
          </a>
        </div>

        <div className="border-border/60 flex flex-col gap-5 border-t pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Insights</h3>
            <span className="text-muted-foreground text-xs">Last {ui.periodDays} days</span>
          </div>
          <LineChart
            data={stats?.daily ?? []}
            config={SEND_ACTIVITY_CONFIG}
            xAxisKey="day"
            activeKey="sent"
            color="var(--chart-1)"
            className="h-[200px]"
            xAxisFormatter={(value) => (Number(value) % 5 === 0 ? String(value) : "")}
          />
          <dl className="grid grid-cols-3 gap-4">
            {[
              { label: "Delivered", value: stats?.deliveredRate ?? "—" },
              { label: "Total sent", value: stats ? String(stats.totalSent) : "—" },
              { label: "Bounce rate", value: stats?.bounceRate ?? "—" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                <dd className="text-sm font-semibold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium">Customer email log</h3>
            <span className="text-muted-foreground text-xs">{filteredEmails.length} events</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Search by email or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="shadow-none sm:flex-1"
            />
            <SelectField
              id="email-status-filter"
              value={statusFilter}
              onChange={setStatusFilter}
              items={EMAIL_STATUS_OPTIONS}
              triggerClassName="shadow-none sm:w-40"
            />
          </div>
          <DataTable
            data={filteredEmails}
            columns={EMAIL_COLUMNS}
            withFilterPill={false}
            emptyMessage="No emails match your search."
            containerClassName="[&_.bg-card]:shadow-none"
          />
        </div>

        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Contact sync</h3>
              <p className="text-muted-foreground max-w-md text-sm">
                Auto-sync new customers to your Resend audience on customer.created.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-muted-foreground text-xs">{customerSyncEnabled ? "On" : "Off"}</span>
              <Switch checked={customerSyncEnabled} onCheckedChange={handleToggleSync} disabled={isSaving} />
            </div>
          </div>
        </div>

        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium">Notification rules</h3>
            <span className="text-muted-foreground text-xs">Select a template to enable; leave blank to disable</span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Template</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {WEBHOOK_EVENT_TYPES.map((event) => (
                  <TableRow key={event}>
                    <TableCell className="font-mono text-xs">{event}</TableCell>
                    <TableCell>
                      <SelectField
                        id={event}
                        value={(settings[`${event}.templateId`] as string) ?? "__none__"}
                        onChange={(v) => handleTemplateChange(event, v)}
                        items={templateOptions}
                        isLoading={templatesLoading}
                        disabled={isSaving}
                        triggerClassName="shadow-none h-8 text-xs w-48"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex w-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Dashboard />
    </React.Suspense>
  );
}
