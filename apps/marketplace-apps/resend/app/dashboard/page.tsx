"use client";

import { Suspense, useMemo, useState } from "react";

import { retrieveEmailTemplates, updateSettings } from "@/app/actions/resend";
import { useStellarToolsContext, useStellarToolsMutation, useStellarToolsQuery } from "@stellartools/app-sdk";
import {
  Badge,
  DataTable,
  Input,
  LineChart,
  SelectField,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@stellartools/shared-ui";
import { useSearchParams } from "next/navigation";

type StatsEmail = { id: string; to: string; subject: string; status: string; sentAt: string };
type EmailRow = { original: StatsEmail };

type Stats = {
  totalSent: number;
  deliveredRate: string;
  bounceRate: string;
  daily: { day: number; sent: number }[];
  emails: StatsEmail[];
};

type TemplateIds = {
  paymentReceivedTemplateId?: string;
  paymentFailedTemplateId?: string;
  refundSucceededTemplateId?: string;
  subscriptionCreatedTemplateId?: string;
  subscriptionCanceledTemplateId?: string;
  customerWelcomeTemplateId?: string;
};

type NotificationRule = { id: string; event: string; templateKey: keyof TemplateIds };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  delivered: "default",
  opened: "secondary",
  sent: "outline",
  bounced: "destructive",
};

const SEND_ACTIVITY_CONFIG = { sent: { label: "Emails sent", color: "var(--chart-1)" } };

const EMAIL_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "delivered", label: "Delivered" },
  { value: "bounced", label: "Bounced" },
  { value: "opened", label: "Opened" },
  { value: "sent", label: "Sent" },
];

const NOTIFICATION_RULES: NotificationRule[] = [
  { id: "rule_01", event: "payment.confirmed", templateKey: "paymentReceivedTemplateId" },
  { id: "rule_02", event: "payment.failed", templateKey: "paymentFailedTemplateId" },
  { id: "rule_03", event: "refund.succeeded", templateKey: "refundSucceededTemplateId" },
  { id: "rule_04", event: "subscription.created", templateKey: "subscriptionCreatedTemplateId" },
  { id: "rule_05", event: "subscription.canceled", templateKey: "subscriptionCanceledTemplateId" },
  { id: "rule_06", event: "customer.created", templateKey: "customerWelcomeTemplateId" },
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

function Dashboard() {
  const { settings } = useStellarToolsContext();
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token") ?? "";

  const [templateIds, setTemplateIds] = useState<TemplateIds>(() => ({
    paymentReceivedTemplateId: settings.paymentReceivedTemplateId as string | undefined,
    paymentFailedTemplateId: settings.paymentFailedTemplateId as string | undefined,
    refundSucceededTemplateId: settings.refundSucceededTemplateId as string | undefined,
    subscriptionCreatedTemplateId: settings.subscriptionCreatedTemplateId as string | undefined,
    subscriptionCanceledTemplateId: settings.subscriptionCanceledTemplateId as string | undefined,
    customerWelcomeTemplateId: settings.customerWelcomeTemplateId as string | undefined,
  }));
  const [customerSyncEnabled, setCustomerSyncEnabled] = useState(Boolean(settings.customerSyncEnabled));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: stats } = useStellarToolsQuery<Stats>(["stats"], async () => {
    const res = await fetch("/api/stats", {});
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  });

  const { data: templates = [], isLoading: templatesLoading } = useStellarToolsQuery<Array<{ id: string; name: string }>>(
    ["templates"],
    async () => retrieveEmailTemplates(settings.resendApiKey as string),
    { enabled: !!settings.resendApiKey }
  );

  const { mutate: saveSettings } = useStellarToolsMutation(
    async (patch: Partial<TemplateIds>) => updateSettings(appToken, patch as Record<string, string>)
  );

  const { mutate: toggleSync, isPending: syncPending } = useStellarToolsMutation(
    async (enabled: boolean) => updateSettings(appToken, { customerSyncEnabled: enabled }),
    { onMutate: (enabled) => setCustomerSyncEnabled(enabled) }
  );

  const templateOptions = useMemo(
    () => [{ value: "__none__", label: "None" }, ...templates.map((t) => ({ value: t.id, label: t.name }))],
    [templates]
  );

  const filteredEmails = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (stats?.emails ?? []).filter(
      (item) =>
        (!query || item.to.toLowerCase().includes(query) || item.subject.toLowerCase().includes(query)) &&
        (statusFilter === "all" || item.status === statusFilter)
    );
  }, [stats, search, statusFilter]);

  const handleTemplateChange = (rule: NotificationRule, v: string) => {
    const value = v === "__none__" ? undefined : v;
    setTemplateIds((prev) => ({ ...prev, [rule.templateKey]: value }));
    saveSettings({ [rule.templateKey]: value });
  };

  return (
    <div className="bg-background min-h-screen px-5 pb-8">
      <section className="flex flex-col gap-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">Overview</h2>
            <p className="text-muted-foreground text-sm">Email delivery for the last 30 days</p>
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
            <span className="text-muted-foreground text-xs">Last 30 days</span>
          </div>
          <LineChart
            data={stats?.daily ?? []}
            config={SEND_ACTIVITY_CONFIG}
            xAxisKey="day"
            activeKey="sent"
            color="var(--chart-1)"
            className="h-[200px]"
            aria-label="Emails sent over the last 30 days"
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
                Auto-sync new customers to your Resend audience on customer.created. Keeps your contacts up to date
                automatically.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-muted-foreground text-xs">{customerSyncEnabled ? "On" : "Off"}</span>
              <Switch checked={customerSyncEnabled} onCheckedChange={toggleSync} disabled={syncPending} />
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
                {NOTIFICATION_RULES.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-xs">{rule.event}</TableCell>
                    <TableCell>
                      <SelectField
                        id={rule.id}
                        value={templateIds[rule.templateKey] ?? "__none__"}
                        onChange={(v: string) => handleTemplateChange(rule, v)}
                        items={templateOptions}
                        isLoading={templatesLoading}
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
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
