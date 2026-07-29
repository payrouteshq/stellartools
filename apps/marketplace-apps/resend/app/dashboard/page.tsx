"use client";

import * as React from "react";

import { logout, retrieveEmailStats, retrieveEmailTemplates, updateSettings } from "@/app/actions/resend";
import { EmailStats } from "@/app/types";
import {
  type AppContext,
  useStellarToolsContext,
  useStellarToolsMutation,
  useStellarToolsQuery,
} from "@stellartools/app-sdk";
import { Primitive, WEBHOOK_EVENT_TYPES, WebhookEventType } from "@stellartools/core";
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
import { useRouter, useSearchParams } from "next/navigation";

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
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"} className="text-xs capitalize shadow-none">
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
  const router = useRouter();

  const handleLogout = async () => {
    await logout(appToken);
    router.push(`/authentication?st_token=${appToken}`);
  };

  const { settings, ui } = useStellarToolsContext();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const { data: stats, isLoading: statsLoading } = useStellarToolsQuery<EmailStats>(
    ["stats"],
    (ctx: AppContext) => retrieveEmailStats(ctx.settings.resendApiKey as string, ctx.orgId, ctx.ui.periodDays, ctx.env),
    { enabled: !!settings.resendApiKey }
  );

  const { data: templates = [], isLoading: templatesLoading } = useStellarToolsQuery<
    Array<{ id: string; name: string }>
  >(["templates"], () => retrieveEmailTemplates(settings.resendApiKey as string), {
    enabled: !!settings.resendApiKey,
  });

  const { mutate: patchSettings, isPending: isSaving } = useStellarToolsMutation(
    async (patch: Record<string, Primitive>) => {
      return await updateSettings(appToken, patch);
    }
  );

  const [customerSyncEnabled, setCustomerSyncEnabled] = React.useState(() => Boolean(settings.customerSyncEnabled));

  const [templateIds, setTemplateIds] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      WEBHOOK_EVENT_TYPES.map((event) => [event, (settings[`${event}.templateId`] as string) ?? "__none__"])
    )
  );

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
    setTemplateIds((prev) => ({ ...prev, [event]: value }));
    patchSettings({ [`${event}.templateId`]: value === "__none__" ? null : value });
  };

  const handleToggleSync = (enabled: boolean) => {
    setCustomerSyncEnabled(enabled);
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
          <div className="flex items-center gap-3">
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Go to Resend dashboard ↗
            </a>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline"
            >
              Disconnect
            </button>
          </div>
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
            className="h-50"
            xAxisFormatter={(value: string | number) => (Number(value) % 5 === 0 ? String(value) : "")}
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="text-xs shadow-none sm:flex-1"
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
            isLoading={statsLoading}
            data={filteredEmails}
            columns={EMAIL_COLUMNS}
            emptyMessage="No emails match your search."
            containerClassName="[&_.bg-card]:shadow-none **:data-[slot=table-cell]:text-xs **:data-[slot=table-head]:text-xs [&_[data-slot=table-container]::-webkit-scrollbar]:h-1 [&_[data-slot=table-container]::-webkit-scrollbar-thumb]:rounded-full [&_[data-slot=table-container]::-webkit-scrollbar-thumb]:bg-border [&_[data-slot=table-container]::-webkit-scrollbar-track]:bg-transparent"
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
                        value={templateIds[event] ?? "__none__"}
                        onChange={(v: string) => handleTemplateChange(event, v)}
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
