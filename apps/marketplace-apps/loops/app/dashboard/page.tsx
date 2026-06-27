"use client";

import * as React from "react";

import {
  listAvailableEmails,
  listMailingLists,
  logout,
  retrieveActivityStats,
  updateSettings,
} from "@/app/actions/loops";
import { ActivityStats, EmailOption, MailingList } from "@/app/types";
import {
  type AppContext,
  useStellarToolsContext,
  useStellarToolsMutation,
  useStellarToolsQuery,
} from "@stellartools/app-sdk";
import { Primitive, WEBHOOK_EVENT_TYPES, WebhookEventType } from "@stellartools/core";
import {
  DataTable,
  Input,
  SelectField,
  Skeleton,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@stellartools/shared-ui";
import { useRouter, useSearchParams } from "next/navigation";


const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "transactional", label: "Transactional" },
  { value: "event", label: "Workflow event" },
];

const Dashboard = () => {
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token") ?? "";
  const router = useRouter();

  const { settings, ui } = useStellarToolsContext();

  const handleLogout = async () => {
    await logout(appToken);
    router.push(`/authentication?st_token=${appToken}`);
  };

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");

  const { data: stats } = useStellarToolsQuery<ActivityStats>(
    ["stats"],
    (ctx: AppContext) => retrieveActivityStats(ctx.orgId, ctx.ui.periodDays, ctx.env),
    { enabled: !!settings.loopsApiKey }
  );

  const { data: emailOptions = [], isLoading: emailsLoading } = useStellarToolsQuery<EmailOption[]>(
    ["emails"],
    () => listAvailableEmails(settings.loopsApiKey as string),
    { enabled: !!settings.loopsApiKey }
  );

  const { data: mailingLists = [] } = useStellarToolsQuery<MailingList[]>(
    ["lists"],
    () => listMailingLists(settings.loopsApiKey as string),
    { enabled: !!settings.loopsApiKey }
  );

  const { mutate: patchSettings, isPending: isSaving } = useStellarToolsMutation(
    async (patch: Record<string, Primitive>) => updateSettings(appToken, patch)
  );

  const [customerSyncEnabled, setCustomerSyncEnabled] = React.useState(() => Boolean(settings.customerSyncEnabled));
  const [mailingListId, setMailingListId] = React.useState<string>(
    () => (settings.contactSyncMailingListId as string) ?? "__none__"
  );

  const [templateIds, setEmailConfigs] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      WEBHOOK_EVENT_TYPES.map((event) => [event, (settings[`${event}.templateId`] as string) ?? "__none__"])
    )
  );

  const emailSelectOptions = React.useMemo(
    () => [{ value: "__none__", label: "None" }, ...emailOptions],
    [emailOptions]
  );

  const logColumns = React.useMemo(
    () => [
      { accessorKey: "email", header: "Email", enableSorting: true },
      { accessorKey: "eventType", header: "Event", enableSorting: true },
      { accessorKey: "sentAt", header: "Sent at", enableSorting: true },
    ],
    []
  );

  const mailingListOptions = React.useMemo(
    () => [{ value: "__none__", label: "No list" }, ...mailingLists.map((l) => ({ value: l.id, label: l.name }))],
    [mailingLists]
  );

  const filteredLogs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stats?.logs ?? []).filter(
      (item) =>
        (!q || item.email.toLowerCase().includes(q) || item.eventType.toLowerCase().includes(q)) &&
        (typeFilter === "all" || item.sendType === typeFilter)
    );
  }, [stats, search, typeFilter]);

  const handleEmailConfigChange = (event: WebhookEventType, value: string) => {
    setEmailConfigs((prev) => ({ ...prev, [event]: value }));
    patchSettings({ [`${event}.templateId`]: value === "__none__" ? null : value });
  };

  const handleToggleSync = (enabled: boolean) => {
    setCustomerSyncEnabled(enabled);
    patchSettings({ customerSyncEnabled: enabled });
  };

  const handleMailingListChange = (value: string) => {
    setMailingListId(value);
    patchSettings({ contactSyncMailingListId: value === "__none__" ? null : value });
  };

  return (
    <div className="bg-background min-h-screen px-5 pb-8">
      <section className="flex flex-col gap-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">Overview</h2>
            <p className="text-muted-foreground text-sm">Lifecycle emails for the last {ui.periodDays} days</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://app.loops.so"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Go to Loops ↗
            </a>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive text-xs underline-offset-4 hover:underline"
            >
              Disconnect
            </button>
          </div>
        </div>

        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Activity</h3>
            <span className="text-muted-foreground text-xs">Last {ui.periodDays} days</span>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Emails sent",
                value: String(stats?.totalSent ?? 0),
                tooltip: "Total emails triggered by your webhook events in the selected period, tracked in the activity log below.",
              },
              {
                label: "Transactional",
                value: String(stats?.transactionalCount ?? 0),
                tooltip: "Emails sent using a Loops transactional template in the selected period.",
              },
              { label: "Mailing lists", value: String(mailingLists.length), tooltip: undefined },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1 rounded-xl border px-5 py-4">
                <dt className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
                  {stat.label}
                  {stat.tooltip && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-muted-foreground/50 hover:text-muted-foreground cursor-default select-none">
                            ?
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-52 text-xs">{stat.tooltip}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </dt>
                {!stats ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <dd className="text-2xl font-bold tabular-nums">{stat.value}</dd>
                )}
              </div>
            ))}
          </dl>
        </div>

        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium">Activity log</h3>
            <span className="text-muted-foreground text-xs">{filteredLogs.length} events</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Search by email or event…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="text-xs shadow-none sm:flex-1"
            />
            <SelectField
              id="type-filter"
              value={typeFilter}
              onChange={setTypeFilter}
              items={TYPE_FILTER_OPTIONS}
              triggerClassName="shadow-none sm:w-44"
            />
          </div>
          <DataTable
            data={filteredLogs}
            columns={logColumns}
            withFilterPill={false}
            emptyMessage="No activity yet."
            containerClassName="[&_.bg-card]:shadow-none"
          />
        </div>

        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Contact sync</h3>
              <p className="text-muted-foreground max-w-md text-sm">
                Auto-add new customers to your Loops audience on customer.created.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-muted-foreground text-xs">{customerSyncEnabled ? "On" : "Off"}</span>
              <Switch checked={customerSyncEnabled} onCheckedChange={handleToggleSync} disabled={isSaving} />
            </div>
          </div>
          {customerSyncEnabled && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">Mailing list</span>
              <SelectField
                id="mailing-list"
                value={mailingListId}
                onChange={handleMailingListChange}
                items={mailingListOptions}
                disabled={isSaving}
                triggerClassName="shadow-none h-8 text-xs w-56"
              />
            </div>
          )}
        </div>

        <div className="border-border/60 flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-medium">Notification rules</h3>
            <span className="text-muted-foreground text-xs">Select a transactional email; leave blank to skip</span>
          </div>
          <div className="bg-muted/40 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs leading-relaxed">
              <span className="text-foreground font-medium">Using Loops workflows? </span>
              Create a workflow in Loops and set its trigger to the event name from the row, replacing dots with underscores (e.g. <span className="font-mono">payment.confirmed</span> becomes <span className="font-mono">payment_confirmed</span>). It will run automatically when that event fires. Only transactional emails need to be selected below.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Transactional Email</TableHead>
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
                        onChange={(v: string) => handleEmailConfigChange(event, v)}
                        items={emailSelectOptions}
                        isLoading={emailsLoading}
                        disabled={isSaving}
                        triggerClassName="shadow-none h-8 text-xs w-56"
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
