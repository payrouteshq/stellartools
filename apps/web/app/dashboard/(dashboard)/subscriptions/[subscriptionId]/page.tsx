"use client";

import * as React from "react";

import { retrieveEvents } from "@/actions/event";
import { retrievePayments } from "@/actions/payment";
import { retrieveSubscriptions } from "@/actions/subscription";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { TIMELINE_ROUTE_MAP } from "@/constant";
import { useAction } from "@/hooks/use-action";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { ApiClient } from "@stellartools/core";
import {
  AppModal,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  CodeBlock,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  Spinner,
  Timeline,
  cn,
  toast,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import _ from "lodash";
import { ChevronRight, Copy, ExternalLink, MoreHorizontal, Pause, Play, XCircle } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  SubscriptionModalContent,
  SubscriptionModalFooter,
  SubscriptionStatusBadge,
  confirmAction,
  formatPeriod,
} from "../_shared";

const formatDate = (d: Date | string) => moment(d).format("D MMM, YYYY");
const formatDateTime = (d: Date | string) => moment(d).format("D MMM, YYYY [at] HH:mm");
const getExplorerUrl = (h: string, e: string) =>
  `https://stellar.expert/explorer/${e === "live" ? "public" : "testnet"}/tx/${h}`;

type PricingRow = {
  name: string;
  period: string;
  price: string;
  total: string;
};

const pricingColumns: ColumnDef<PricingRow>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        <div className="text-muted-foreground text-xs">{row.original.period}</div>
      </div>
    ),
  },
  { accessorKey: "price", header: "Price" },
  {
    accessorKey: "qty",
    header: "Qty",
    cell: () => <span className="text-muted-foreground">1</span>,
  },
  { accessorKey: "total", header: "Total" },
];

export default function SubscriptionDetailPage() {
  const router = useRouter();
  const { subscriptionId } = useParams() as { subscriptionId: string };
  const { data: orgContext } = useOrgContext();

  const { data: allSubs, isLoading } = useOrgQuery(["subscriptions"], async () =>
    retrieveSubscriptions(undefined, undefined, undefined, { withCustomer: true, withProduct: true }).then(
      (res) => res.data
    )
  );
  const sub = React.useMemo(() => allSubs?.find((s) => s.id === subscriptionId), [allSubs, subscriptionId]);

  const { data: subEvents, isLoading: loadingEvents } = useOrgQuery(
    ["subscription-events", subscriptionId],
    () =>
      retrieveEvents({ subscriptionId }, [
        "subscription::created",
        "subscription::updated",
        "subscription::canceled",
        "payment::completed",
      ]),
    { enabled: !!sub }
  );

  const { data: payments = [], isLoading: loadingPayments } = useOrgQuery(
    ["subscription-payments", subscriptionId],
    () => retrievePayments(undefined, undefined, { customerId: sub!.customerId }).then((res) => res.data),
    { enabled: !!sub }
  );

  const subscriptionPayments = React.useMemo(
    () => payments.filter((p) => p.subscriptionId === subscriptionId),
    [payments, subscriptionId]
  );

  const { mutate: updateSubscription, isPending: isUpdatingSubscription } = useAction(
    async ({ path, onComplete = () => {} }: { path: string; onComplete?: () => void | Promise<void> }) => {
      if (!orgContext?.token) throw new AppError("No session token");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token },
      });
      const res = await api.post(`/subscriptions/${subscriptionId}${path}`, {});
      if (res.isErr()) throw new AppError(res.error.message);
      await onComplete();
      return res.value;
    },
    {
      successMsg: "Subscription updated",
      invalidate: [
        ["subscriptions"],
        ["subscription-events", subscriptionId],
        ["subscription-payments", subscriptionId],
      ],
    }
  );

  const { mutate: keepSubscription, isPending: isKeepingSubscription } = useAction(
    async ({ onComplete = () => {} }: { onComplete?: () => void | Promise<void> }) => {
      if (!orgContext?.token) throw new AppError("No session token");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token },
      });
      const res = await api.put(`/subscriptions/${subscriptionId}`, { cancel_at_period_end: false });
      if (res.isErr()) throw new AppError(res.error.message);
      await onComplete();
      return res.value;
    },
    {
      successMsg: "Scheduled cancellation removed",
      invalidate: [
        ["subscriptions"],
        ["subscription-events", subscriptionId],
        ["subscription-payments", subscriptionId],
      ],
    }
  );

  // Modal Sync
  const submitRef = React.useRef<(() => void) | null>(null);
  const [footerState, setFooterState] = React.useState({ isPending: false });

  const openUpdateModal = () => {
    if (!sub) return;
    AppModal.open({
      title: "Update subscription",
      size: "full",
      showCloseButton: true,
      content: (
        <SubscriptionModalContent
          editingSubscription={{
            ...sub,
            customerName: sub.customer?.name,
            customerEmail: sub.customer?.email,
            productName: sub.product?.name,
            productPrice: sub.product?.priceCents,
          }}
          onSuccess={() => AppModal.close()}
          setSubmitRef={submitRef}
          onFooterChange={setFooterState}
        />
      ),
      footer: (
        <SubscriptionModalFooter
          onClose={AppModal.close}
          submitRef={submitRef}
          isPending={footerState.isPending}
          isEditMode
        />
      ),
    });
  };

  if (isLoading) return <Spinner size={25} />;

  if (!sub) return <NotFound router={router} />;

  const s = sub;
  const c = sub.customer;
  const p = sub.product;

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/subscriptions">Subscriptions</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{s.id}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{c?.name ?? c?.email}</h1>
                <span className="text-muted-foreground text-sm">on</span>
                <span className="text-lg font-semibold">{p?.name}</span>
                <SubscriptionStatusBadge
                  status={s.status}
                  cancelAtPeriodEnd={s.cancelAtPeriodEnd ?? false}
                  currentPeriodEnd={s.currentPeriodEnd}
                  canceledAt={s.canceledAt}
                />
              </div>
              <div className="text-muted-foreground mt-1 flex items-center gap-4 text-sm">
                <span>Started {formatDate(s.currentPeriodStart)}</span>
                {!s.cancelAtPeriodEnd && s.status !== "canceled" && (
                  <>
                    <span>&middot;</span>
                    <span>
                      Next billing {Money.formatFiat(p?.priceCents ?? 0, p?.currencyCode ?? "USD")} on{" "}
                      {formatDate(s.currentPeriodEnd)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openUpdateModal}>
                Update subscription
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["active", "trialing"].includes(s.status) && !s.cancelAtPeriodEnd && (
                    <DropdownMenuItem
                      onClick={() =>
                        confirmAction(
                          {
                            title: "Pause subscription",
                            description:
                              "The subscription will be paused and no further charges will be made until it is resumed.",
                            confirmLabel: "Pause",
                          },
                          () => updateSubscription({ path: "/pause", onComplete: AppModal.close }),
                          isUpdatingSubscription
                        )
                      }
                    >
                      <Pause className="mr-2 h-4 w-4" /> Pause
                    </DropdownMenuItem>
                  )}
                  {s.status === "paused" && (
                    <DropdownMenuItem
                      onClick={() =>
                        confirmAction(
                          {
                            title: "Resume subscription",
                            description:
                              "The subscription will become active again and billing will resume on the next cycle.",
                            confirmLabel: "Resume",
                          },
                          () => updateSubscription({ path: "/resume", onComplete: AppModal.close }),
                          isUpdatingSubscription
                        )
                      }
                    >
                      <Play className="mr-2 h-4 w-4" /> Resume
                    </DropdownMenuItem>
                  )}
                  {s.cancelAtPeriodEnd && s.status !== "canceled" && (
                    <DropdownMenuItem
                      onClick={() =>
                        confirmAction(
                          {
                            title: "Keep subscription",
                            description:
                              "Remove the scheduled cancellation? The subscription will renew normally at the end of the current billing period.",
                            confirmLabel: "Keep subscription",
                          },
                          () => keepSubscription({ onComplete: AppModal.close }),
                          isKeepingSubscription
                        )
                      }
                    >
                      <Play className="mr-2 h-4 w-4" /> Keep subscription
                    </DropdownMenuItem>
                  )}
                  {s.status !== "canceled" && !s.cancelAtPeriodEnd && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        confirmAction(
                          {
                            title: "Cancel subscription",
                            description: `The subscription will cancel at the end of the current billing period (${formatDate(s.currentPeriodEnd)}). The customer keeps access until then and will not be charged again.`,
                            confirmLabel: "Cancel at period end",
                            destructive: true,
                          },
                          () => updateSubscription({ path: "/cancel", onComplete: AppModal.close }),
                          isUpdatingSubscription
                        )
                      }
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Cancel
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Pricing</h3>
                <DataTable
                  columns={pricingColumns}
                  data={
                    p
                      ? [
                          {
                            name: p.name ?? "—",
                            period: formatPeriod(p.recurringPeriod, p.customDurationMs),
                            price: Money.formatFiat(p.priceCents ?? 0, p.currencyCode ?? "USD"),
                            total: `${Money.formatFiat(p.priceCents ?? 0, p.currencyCode ?? "USD")} / ${formatPeriod(p.recurringPeriod, p.customDurationMs)}`,
                          },
                        ]
                      : []
                  }
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Invoices</h3>
                <div className="bg-card overflow-hidden rounded-lg border">
                  {loadingPayments ? (
                    <div className="flex justify-center p-10">
                      <Spinner size={25} />
                    </div>
                  ) : subscriptionPayments.length === 0 ? (
                    <div className="text-muted-foreground p-6 text-center text-sm">No payments yet</div>
                  ) : (
                    <div className="divide-y">
                      <div className="text-muted-foreground bg-muted/20 grid grid-cols-5 gap-4 px-4 py-2.5 text-xs font-medium uppercase">
                        <span>Amount</span>
                        <span>Status</span>
                        <span>Customer</span>
                        <span>Created</span>
                        <span className="text-right">Tx</span>
                      </div>
                      {subscriptionPayments.map((p) => (
                        <div key={p.id} className="hover:bg-muted/50 grid grid-cols-5 items-center gap-4 px-4 py-3">
                          <div className="text-sm font-medium">
                            {Money.formatFiat(p.amountCents, p.currencyCode ?? "USD")}
                          </div>
                          <div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] tracking-tighter uppercase",
                                p.status === "confirmed" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                              )}
                            >
                              {p.status === "confirmed" ? "Paid" : p.status}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground truncate text-xs">{c?.email}</div>
                          <div className="text-muted-foreground text-xs">
                            {moment(p.createdAt).format("D MMM, HH:mm")}
                          </div>
                          <div className="text-right">
                            {p.transactionHash && (
                              <a
                                href={getExplorerUrl(p.transactionHash, s.environment)}
                                target="_blank"
                                className="text-primary"
                              >
                                <ExternalLink className="inline h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Events</h3>
                <Timeline
                  isLoading={loadingEvents}
                  items={subEvents ?? []}
                  limit={5}
                  renderItem={(evt) => ({
                    title: _.startCase(evt.type.replace(/::/g, " ")),
                    date: formatDateTime(evt.createdAt),
                    data: evt.data,
                    contentOverride: evt.data?.transactionHash ? (
                      <a
                        href={getExplorerUrl(String(evt.data.transactionHash), s.environment)}
                        target="_blank"
                        className="text-primary mt-1 flex items-center gap-1 text-xs hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> View transaction
                      </a>
                    ) : undefined,
                  })}
                  routeMap={TIMELINE_ROUTE_MAP}
                  linkComponent={Link}
                />
              </section>
            </div>

            <aside className="sticky top-20 space-y-6">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Details</h3>
                <div className="bg-card space-y-4 rounded-lg border p-5">
                  <DetailRow label="Customer" value={c?.name ?? c?.email ?? "—"} href={`/customers/${s.customerId}`} />
                  <Separator />
                  <DetailRow label="Created" value={formatDateTime(s.createdAt)} />
                  <Separator />
                  <DetailRow
                    label="Current period"
                    value={`${formatDate(s.currentPeriodStart)} to ${formatDate(s.currentPeriodEnd)}`}
                  />
                  <Separator />
                  <DetailRow label="ID" value={s.id} copy={s.id} mono />
                  {s.pausedAt && (
                    <>
                      <Separator />
                      <DetailRow label="Paused on" value={formatDateTime(s.pausedAt)} />
                    </>
                  )}
                  {s.canceledAt && (
                    <>
                      <Separator />
                      <DetailRow label="Canceled on" value={formatDateTime(s.canceledAt)} />
                    </>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Metadata</h3>
                {s.metadata && Object.keys(s.metadata).length > 0 ? (
                  <CodeBlock language="json">{JSON.stringify(s.metadata, null, 2)}</CodeBlock>
                ) : (
                  <div className="text-muted-foreground rounded-lg border-2 border-dashed p-6 text-center text-xs">
                    No metadata
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}

const DetailRow = ({ label, value, href, copy, mono }: any) => (
  <div className="flex items-start justify-between gap-4 text-sm">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <div className="flex items-center gap-1.5 text-right">
      {href ? (
        <Link href={href} className="text-primary font-medium hover:underline">
          {value}
        </Link>
      ) : (
        <span className={cn(mono && "font-mono text-xs")}>{value}</span>
      )}
      {copy && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(copy);
            toast.success("Copied");
          }}
          className="hover:bg-muted rounded p-1"
        >
          <Copy className="text-muted-foreground h-3 w-3" />
        </button>
      )}
    </div>
  </div>
);

const NotFound = ({ router }: any) => (
  <DashboardSidebarInset>
    <div className="py-24 text-center">
      <h1 className="text-2xl font-bold">Subscription not found</h1>
      <Button onClick={() => router.push("/subscriptions")} className="mt-4">
        Back to list
      </Button>
    </div>
  </DashboardSidebarInset>
);
