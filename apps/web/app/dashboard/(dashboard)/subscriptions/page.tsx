"use client";

import * as React from "react";

import { retrieveSubscriptions } from "@/actions/subscription";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { subscriptionStatusEnum } from "@/constant/schema.client";
import { useAction } from "@/hooks/use-action";
import { useInvalidateOrgQuery, useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { ApiClient } from "@stellartools/core";
import { AppModal, Button, DataTable, cn } from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import moment from "moment";
import { useRouter } from "next/navigation";

import {
  SubscriptionModalContent,
  SubscriptionModalFooter,
  SubscriptionRowEsquee,
  SubscriptionStatusBadge,
  confirmAction,
  formatPeriod,
} from "./_shared";

export default function SubscriptionsPage() {
  const router = useRouter();
  const invalidate = useInvalidateOrgQuery();
  const { data: orgContext } = useOrgContext();
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [columnFilters, setColumnFilters] = useSyncTableFilters();
  const submitRef = React.useRef<(() => void) | null>(null);
  const [footerState, setFooterState] = React.useState({ isPending: false });

  const { mutate: updateSubscription, isPending: isUpdatingSubscription } = useAction(
    async ({
      id,
      path,
      onComplete = () => {},
    }: {
      id: string;
      path: string;
      onComplete?: () => void | Promise<void>;
    }) => {
      if (!orgContext?.token) throw new AppError("No session token");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token },
      });
      const res = await api.post(`/subscriptions/${id}${path}`, {});
      if (res.isErr()) throw new AppError(res.error.message);
      await onComplete();
      return res.value;
    },
    { invalidate: ["subscriptions"] }
  );

  const { data: subs = [], isLoading } = useOrgQuery(["subscriptions"], async () =>
    retrieveSubscriptions(undefined, undefined, undefined, { withCustomer: true, withProduct: true }).then(
      (res) => res.data
    )
  );

  const stats = React.useMemo(() => {
    const counts = { all: subs.length, active: 0, paused: 0, canceled: 0 };
    subs.forEach((s) => {
      if (s.status in counts) counts[s.status as keyof typeof counts]++;
    });
    return counts;
  }, [subs]);

  const rows = React.useMemo(
    () =>
      subs
        .filter((s) => activeTab === "all" || s.status === activeTab)
        .map(
          (s): SubscriptionRowEsquee => ({
            id: s.id,
            customer: s.customer?.name ?? "—",
            customerEmail: s.customer?.email,
            status: s.status,
            cancelAtPeriodEnd: s.cancelAtPeriodEnd ?? false,
            product: s.product?.name,
            amount: s.product?.priceCents,
            currencyCode: s.product?.currencyCode ?? "USD",
            period: s.product?.recurringPeriod,
            customDurationMs: s.product?.customDurationMs,
            currentPeriodEnd: s.currentPeriodEnd,
            createdAt: s.createdAt,
          })
        ),
    [subs, activeTab]
  );

  const columns: ColumnDef<SubscriptionRowEsquee>[] = [
    {
      accessorKey: "customerEmail",
      header: "Customer",
      meta: { filterable: true, filterVariant: "text" },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.customer}</div>
          <div className="text-muted-foreground text-xs">{row.original.customerEmail}</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: {
        filterable: true,
        filterVariant: "select",
        filterOptions: Object.values(subscriptionStatusEnum).map((s) => ({ label: moment().format(s), value: s })),
      },
      cell: ({ row }) => (
        <SubscriptionStatusBadge
          status={row.original.status}
          cancelAtPeriodEnd={row.original.cancelAtPeriodEnd}
          currentPeriodEnd={row.original.currentPeriodEnd}
        />
      ),
    },
    {
      accessorKey: "product",
      header: "Product",
      cell: ({ row }) => <div className="font-medium">{row.original.product}</div>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.original.amount;
        if (amount == null) return <div className="text-muted-foreground text-sm">—</div>;
        const period = row.original.period;
        const customMs = row.original.customDurationMs;
        const periodLabel: Record<string, string> = { day: "day", week: "wk", month: "mo", year: "yr" };
        let suffix = "";
        if (period === "custom" && customMs) {
          const periodStr = formatPeriod(period, customMs);
          suffix = ` / ${periodStr}`;
        } else if (period) {
          suffix = ` / ${periodLabel[period] ?? period}`;
        }
        return (
          <div className="text-sm">
            {Money.formatFiat(amount, row.original.currencyCode)}
            {suffix}
          </div>
        );
      },
    },
    {
      accessorKey: "currentPeriodEnd",
      header: "Expires",
      meta: { filterable: true, filterVariant: "date" },
      cell: ({ row }) => (
        <div className="text-muted-foreground text-sm">
          {moment(row.original.currentPeriodEnd).format("D MMM, HH:mm")}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      meta: { filterable: true, filterVariant: "date" },
      cell: ({ row }) => (
        <div className="text-muted-foreground text-sm">{moment(row.original.createdAt).format("D MMM, HH:mm")}</div>
      ),
    },
  ];

  const openModal = () =>
    AppModal.open({
      title: "Create subscription",
      size: "full",
      showCloseButton: true,
      content: (
        <SubscriptionModalContent
          onSuccess={() => {
            invalidate(["subscriptions"]);
            AppModal.close();
          }}
          setSubmitRef={submitRef}
          onFooterChange={setFooterState}
        />
      ),
      footer: (
        <SubscriptionModalFooter onClose={AppModal.close} submitRef={submitRef} isPending={footerState.isPending} />
      ),
    });

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
            <Button className="gap-2" onClick={openModal}>
              <Plus className="h-4 w-4" /> Create subscription
            </Button>
          </div>

          <div className="border-border flex items-center gap-1 border-b">
            {["all", "active", "paused", "canceled"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "hover:text-foreground relative px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === tab ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab !== "all" && (stats as any)[tab] > 0 && (
                  <span className="ml-1.5 text-xs">({(stats as any)[tab]})</span>
                )}
                {activeTab === tab && <div className="bg-primary absolute right-0 bottom-0 left-0 h-0.5" />}
              </button>
            ))}
          </div>

          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            onRowClick={(r) => router.push(`/subscriptions/${r.id}`)}
            actions={(r) => [
              ...(r.status === "paused"
                ? [
                    {
                      label: "Resume",
                      onClick: () =>
                        confirmAction(
                          {
                            title: "Resume subscription",
                            description:
                              "The subscription will become active again and billing will resume on the next cycle.",
                            confirmLabel: "Resume",
                          },
                          () => updateSubscription({ id: r.id, path: "/resume", onComplete: AppModal.close }),
                          isUpdatingSubscription
                        ),
                    },
                  ]
                : r.status !== "canceled" && !r.cancelAtPeriodEnd
                  ? [
                      {
                        label: "Pause",
                        onClick: () =>
                          confirmAction(
                            {
                              title: "Pause subscription",
                              description:
                                "The subscription will be paused and no further charges will be made until it is resumed.",
                              confirmLabel: "Pause",
                            },
                            () => updateSubscription({ id: r.id, path: "/pause", onComplete: AppModal.close }),
                            isUpdatingSubscription
                          ),
                      },
                    ]
                  : []),
              ...(r.status !== "canceled" && !r.cancelAtPeriodEnd
                ? [
                    {
                      label: "Cancel",
                      variant: "destructive" as const,
                      onClick: () =>
                        confirmAction(
                          {
                            title: "Cancel subscription",
                            description: `The subscription will cancel at the end of the current billing period (${moment(r.currentPeriodEnd).format("MMM D, YYYY")}). The customer keeps access until then and will not be charged again.`,
                            confirmLabel: "Cancel at period end",
                            destructive: true,
                          },
                          () => updateSubscription({ id: r.id, path: "/cancel", onComplete: AppModal.close }),
                          isUpdatingSubscription
                        ),
                    },
                  ]
                : []),
            ]}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
          />
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
