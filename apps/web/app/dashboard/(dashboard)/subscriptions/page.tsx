"use client";

import * as React from "react";

import { retrieveSubscriptions } from "@/actions/subscription";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { subscriptionStatusEnum } from "@/constant/schema.client";
import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { Money } from "@/lib/money";
import { cn } from "@stellartools/shared-ui";
import { AppModal, Badge, Button, DataTable } from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import moment from "moment";
import { useRouter } from "next/navigation";

import { SubscriptionModalContent, SubscriptionModalFooter } from "./_shared";

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  active: { cls: "bg-green-500/10 text-green-700 border-green-500/20", label: "Active" },
  trialing: { cls: "bg-blue-500/10 text-blue-700 border-blue-500/20", label: "Trialing" },
  past_due: { cls: "bg-orange-500/10 text-orange-700 border-orange-500/20", label: "Past due" },
  canceled: { cls: "bg-gray-500/10 text-gray-700 border-gray-500/20", label: "Canceled" },
  paused: { cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", label: "Paused" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.active;
  return (
    <Badge variant="outline" className={cn("gap-1.5", cfg.cls)}>
      {cfg.label}
    </Badge>
  );
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const invalidate = useInvalidateOrgQuery();
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [columnFilters, setColumnFilters] = useSyncTableFilters();
  const submitRef = React.useRef<(() => void) | null>(null);
  const [footerState, setFooterState] = React.useState({ isPending: false });

  const { data: subs = [], isLoading } = useOrgQuery(["subscriptions"], async () =>
    retrieveSubscriptions(undefined, undefined).then((res) => res.data)
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
        .map((s) => ({
          id: s.id,
          customer: s.customer?.name ?? "—",
          customerEmail: s.customer?.email,
          status: s.status,
          product: s.product?.name,
          amount: s.product?.priceCents,
          createdAt: s.createdAt,
        })),
    [subs, activeTab]
  );

  const columns: ColumnDef<any>[] = [
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
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "product",
      header: "Product",
      cell: ({ row }) => <div className="font-medium">{row.original.product}</div>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <div className="text-sm">{Money.format(row.original.amount, row.original.currencyCode)} XLM / mo</div>
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
            actions={(r) => [{ label: "View details", onClick: () => router.push(`/subscriptions/${r.id}`) }]}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
          />
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
