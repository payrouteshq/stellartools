"use client";

import * as React from "react";

import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@stellartools/core";
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

// Static stand-in for the real `EmailStats` shape returned by
// retrieveEmailStats() in apps/marketplace-apps/resend/app/actions/resend.ts
type MockEmail = { id: string; to: string; subject: string; status: string; sentAt: string };

const DAILY_SENDS = [2, 3, 2, 4, 3, 9, 14, 6, 3, 2, 4, 3, 5, 8, 12, 7, 4, 3, 2, 4, 3, 6, 10, 15, 8, 4, 3, 5, 4, 3].map(
  (sent, i) => ({ day: i + 1, sent })
);

const MOCK_EMAILS: MockEmail[] = [
  { id: "1", to: "sarah@acme.io", subject: "Your payment receipt", status: "delivered", sentAt: "2 min ago" },
  { id: "2", to: "j.moreno@vertex.co", subject: "Subscription renewed", status: "opened", sentAt: "41 min ago" },
  { id: "3", to: "hello@nebula.dev", subject: "Refund confirmation", status: "delivered", sentAt: "3 hr ago" },
  { id: "4", to: "priya@stellartools.dev", subject: "Welcome to StellarTools", status: "opened", sentAt: "5 hr ago" },
  { id: "5", to: "finance@acme.io", subject: "Your payment receipt", status: "sent", sentAt: "6 hr ago" },
  { id: "6", to: "d.chen@vertex.co", subject: "Trial ending in 3 days", status: "bounced", sentAt: "1 day ago" },
  { id: "7", to: "hello@nebula.dev", subject: "Subscription renewed", status: "delivered", sentAt: "1 day ago" },
  { id: "8", to: "ops@acme.io", subject: "Payment failed", status: "delivered", sentAt: "2 days ago" },
];

const MOCK_TEMPLATES = [
  { id: "tmpl_receipt", name: "Payment Receipt" },
  { id: "tmpl_welcome", name: "Welcome Email" },
  { id: "tmpl_dunning", name: "Payment Failed" },
];

const DEFAULT_TEMPLATE_IDS: Partial<Record<WebhookEventType, string>> = {
  "customer.created": "tmpl_welcome",
  "payment.confirmed": "tmpl_receipt",
  "payment.failed": "tmpl_dunning",
};

type EmailRow = { original: MockEmail };

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

// Faithful static reproduction of apps/marketplace-apps/resend/app/dashboard/page.tsx
// — same shared-ui primitives, same section layout, same copy — with local
// state standing in for the real app's server actions/DB-backed data.
export function ResendAppPanel({ onDisconnect }: { onDisconnect: () => void }) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [customerSyncEnabled, setCustomerSyncEnabled] = React.useState(true);
  const [templateIds, setTemplateIds] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(WEBHOOK_EVENT_TYPES.map((event) => [event, DEFAULT_TEMPLATE_IDS[event] ?? "__none__"]))
  );

  const templateOptions = React.useMemo(
    () => [{ value: "__none__", label: "None" }, ...MOCK_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))],
    []
  );

  const filteredEmails = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_EMAILS.filter(
      (item) =>
        (!q || item.to.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)) &&
        (statusFilter === "all" || item.status === statusFilter)
    );
  }, [search, statusFilter]);

  const totalSent = DAILY_SENDS.reduce((sum, d) => sum + d.sent, 0);

  return (
    <div className="px-1 pb-2">
      <section className="flex flex-col gap-8 py-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">Overview</h2>
            <p className="text-muted-foreground text-sm">Email delivery for the last 30 days</p>
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
              onClick={onDisconnect}
              className="text-muted-foreground hover:text-destructive cursor-pointer text-xs underline-offset-4 hover:underline"
            >
              Disconnect
            </button>
          </div>
        </div>

        <div className="border-border/60 flex flex-col gap-5 border-t pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Insights</h3>
            <span className="text-muted-foreground text-xs">Last 30 days</span>
          </div>
          <LineChart
            data={DAILY_SENDS}
            config={SEND_ACTIVITY_CONFIG}
            xAxisKey="day"
            activeKey="sent"
            color="var(--chart-1)"
            className="h-50"
            xAxisFormatter={(value) => (Number(value) % 5 === 0 ? String(value) : "")}
          />
          <dl className="grid grid-cols-3 gap-4">
            {[
              { label: "Delivered", value: "94.2%" },
              { label: "Total sent", value: String(totalSent) },
              { label: "Bounce rate", value: "1.4%" },
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
            data={filteredEmails}
            columns={EMAIL_COLUMNS}
            emptyMessage="No emails match your search."
            containerClassName="[&_.bg-card]:shadow-none [&_[data-slot=table-cell]]:text-xs [&_[data-slot=table-head]]:text-xs"
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
              <Switch checked={customerSyncEnabled} onCheckedChange={setCustomerSyncEnabled} />
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
                        onChange={(v: string) => setTemplateIds((prev) => ({ ...prev, [event]: v }))}
                        items={templateOptions}
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
