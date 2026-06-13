"use client";

import * as React from "react";

import { retrievePayments } from "@/actions/payment";
import {
  RefundModalContent,
  RefundModalFooter,
  TransactionEsquee,
} from "@/app/dashboard/(dashboard)/transactions/_shared";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { PaymentStatus, paymentStatusEnum } from "@/constant/schema.client";
import { ResolvedPayment } from "@/db";
import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { Money } from "@/lib/money";
import { truncate } from "@/lib/utils";
import {
  AppModal,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  TableAction,
  cn,
  useCopy,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, Copy, Download, Plus, Settings, Wallet, XCircle } from "lucide-react";
import moment from "moment";
import { useRouter, useSearchParams } from "next/navigation";

// --- Status Badge Component ---

const StatusBadge = ({ status }: { status: PaymentStatus | "refunded" }) => {
  const variants = {
    confirmed: {
      className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      icon: CheckCircle2,
      label: "Confirmed",
    },
    refunded: {
      className: "bg-muted text-muted-foreground border-border",
      icon: CheckCircle2,
      label: "Refunded",
    },
    failed: {
      className: "bg-destructive/10 text-destructive-foreground border-destructive/20",
      icon: XCircle,
      label: "Failed",
    },
    pending: {
      className: "bg-primary/10 text-primary-foreground border-primary/20",
      icon: Clock,
      label: "Pending",
    },
  };

  const variant = variants[status];
  const Icon = variant.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5 border", variant.className)}>
      <Icon className="h-3 w-3" />
      {variant.label}
    </Badge>
  );
};

// --- Copy Wallet Address Component ---

const CopyWalletAddress = ({ address }: { address: string }) => {
  const { copied, handleCopy } = useCopy();

  const displayAddress = truncate(address, { start: 4, end: 4 });

  return (
    <div className="flex items-center gap-2">
      <Wallet className="text-muted-foreground h-4 w-4" />
      <span className="font-mono text-sm">{displayAddress}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-6 w-6"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy({
            text: address,
            message: "Wallet address copied to clipboard",
          });
        }}
        title="Copy wallet address"
      >
        {copied ? (
          <CheckMark2 width={16} height={16} className="text-green-600" />
        ) : (
          <Copy className="text-muted-foreground h-4 w-4" />
        )}
      </Button>
    </div>
  );
};

// --- Table Columns ---

const columns: ColumnDef<TransactionEsquee>[] = [
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { filterable: true, filterVariant: "number" },
    cell: ({ row }) => {
      const transaction = row.original;
      return <div className="font-semibold">{Money.formatFiat(transaction.amountCents, transaction.currencyCode)}</div>;
    },
  },
  {
    accessorKey: "paymentMethod",
    header: "Payment method",
    meta: { filterable: true, filterVariant: "text" },
    cell: ({ row }) => {
      const transaction = row.original;
      return <CopyWalletAddress address={transaction.walletAddress ?? ""} />;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      return <div className="text-muted-foreground font-mono text-sm">{row.original.description}</div>;
    },
  },
  {
    accessorKey: "customer",
    header: "Customer",
    meta: { filterable: true, filterVariant: "text" },
    cell: ({ row }) => {
      return <div className="text-sm">{row.original.customer?.email}</div>;
    },
  },
  {
    accessorKey: "date",
    header: "Date",
    meta: { filterable: true, filterVariant: "date" },
    cell: ({ row }) => {
      const date = row.original.createdAt;
      return <div className="text-muted-foreground text-sm">{moment(date).format("MMM D, h:mm A")}</div>;
    },
  },
  {
    accessorKey: "refundedDate",
    header: "Refunded date",
    cell: ({ row }) => {
      const refundedDate = row.original.refundedDate;
      return (
        <div className="text-muted-foreground text-sm">
          {refundedDate ? moment(refundedDate).format("MMM D, h:mm A") : "—"}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      filterable: true,
      filterVariant: "select",
      filterOptions: [...paymentStatusEnum, "refunded"].map((status) => ({
        label: status.charAt(0).toUpperCase() + status.slice(1),
        value: status,
      })),
    },
    cell: ({ row }) => {
      return <StatusBadge status={row.original.status} />;
    },
  },
];

type TabType = "all" | "refunded" | PaymentStatus;

function TransactionsPageContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams?.get("customer");
  const paymentId = searchParams?.get("paymentId");
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<TabType>("all");
  const invalidate = useInvalidateOrgQuery();

  const refundModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [refundModalFooterProps, setRefundModalFooterProps] = React.useState({
    isPending: false,
  });
  const isRefundModalOpenRef = React.useRef(false);

  const [columnFilters, setColumnFilters] = useSyncTableFilters();

  React.useEffect(() => {
    if (!isRefundModalOpenRef.current) return;
    AppModal.updateConfig({
      footer: (
        <RefundModalFooter
          onClose={AppModal.close}
          submitRef={refundModalSubmitRef}
          isPending={refundModalFooterProps.isPending}
        />
      ),
    });
  }, [refundModalFooterProps.isPending]);

  const openRefundModal = React.useCallback(
    (paymentToRefund: ResolvedPayment | null) => {
      isRefundModalOpenRef.current = true;
      setRefundModalFooterProps({ isPending: false });
      AppModal.open({
        title: "Create Refund",
        description: "Process a refund for a transaction by providing the payment details.",
        content: (
          <RefundModalContent
            payment={paymentToRefund}
            initialPaymentId={paymentToRefund?.id}
            onClose={() => {
              isRefundModalOpenRef.current = false;
              AppModal.close();
            }}
            onSuccess={() => {
              invalidate(["refunds"]);
              isRefundModalOpenRef.current = false;
              AppModal.close();
            }}
            setSubmitRef={refundModalSubmitRef}
            onFooterChange={(props) => setRefundModalFooterProps(props)}
          />
        ),
        footer: <RefundModalFooter onClose={AppModal.close} submitRef={refundModalSubmitRef} isPending={false} />,
        size: "small",
        showCloseButton: true,
      });
    },
    [invalidate]
  );

  const { data: payments, isLoading } = useOrgQuery(["payments"], () =>
    retrievePayments(undefined, undefined, undefined, {
      withRefunds: true,
      withCustomer: true,
      withWallets: true,
    }).then((res) => res.data)
  );

  const stats = React.useMemo(() => {
    if (!payments?.length) {
      return { all: 0, succeeded: 0, refunded: 0, failed: 0 };
    }

    return payments.reduce(
      (acc, p) => ({
        ...acc,
        all: acc.all + 1,
        succeeded: acc.succeeded + (p.status === "confirmed" ? 1 : 0),
        refunded: acc.refunded + (p.refunds?.status === "succeeded" ? 1 : 0),
        failed: acc.failed + (p.status === "failed" ? 1 : 0),
      }),
      { all: 0, succeeded: 0, refunded: 0, failed: 0 }
    );
  }, [payments]);

  const filteredTransactions = React.useMemo(() => {
    return (payments ?? []).filter((p) => {
      // 1. Identity Filters (Only filter if the search param exists)
      const matchesCustomer = !customerId || p.customer?.email === customerId;
      const matchesId = !paymentId || [p.id, p.checkoutId].includes(paymentId);

      // 2. Tab/Status Filters
      const matchesTab =
        activeTab === "all" || (activeTab === "refunded" ? p.refunds?.status === "succeeded" : p.status === activeTab);

      // Only include if all conditions are met
      return matchesCustomer && matchesId && matchesTab;
    });
  }, [payments, activeTab, customerId, paymentId]);

  const tableActions = (row: TransactionEsquee): TableAction<TransactionEsquee>[] => {
    const actions: Array<TableAction<TransactionEsquee>> = [
      {
        label: "View details",
        onClick: (transaction) => router.push(`/transactions/${transaction.id}`),
      },
      {
        label: "Delete",
        onClick: (transaction) => console.log("Delete", transaction),
        variant: "destructive",
      },
    ];

    if (row.status === "confirmed") {
      actions.push({
        label: "Refund",
        onClick: (transaction) => {
          openRefundModal(payments?.find(({ id }) => transaction.id == id) ?? null);
        },
      });
    }

    return actions;
  };

  const tabs = [
    { id: "all" as TabType, label: "All", count: stats.all },
    { id: "confirmed" as TabType, label: "Succeeded", count: stats.succeeded },
    { id: "refunded" as TabType, label: "Refunded", count: stats.refunded },
    { id: "failed" as TabType, label: "Failed", count: stats.failed },
  ];

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-8 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="gap-2 shadow-sm"
                  onClick={() => {
                    openRefundModal(null);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Create refund
                </Button>
              </div>
            </div>

            <div className="border-border flex items-center gap-1 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "hover:text-foreground relative px-4 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                  {activeTab === tab.id && <div className="bg-primary absolute right-0 bottom-0 left-0 h-0.5" />}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {tabs.map((tab) => (
                <Card
                  key={tab.id}
                  className={cn(
                    "cursor-pointer shadow-none transition-colors",
                    activeTab === tab.id && "border-primary"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm font-medium">{tab.label}</p>
                      <p className="text-2xl font-bold tracking-tight">{tab.count}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Edit columns
                </Button>
              </div>
            </div>

            <div className="overflow-hidden">
              <DataTable
                columns={columns}
                data={filteredTransactions.map((it) => ({
                  id: it.id,
                  amountCents: it.amountCents,
                  currencyCode: it.currencyCode,
                  status: (it.refunds?.status === "succeeded" ? "refunded" : it.status) as PaymentStatus,
                  createdAt: it.createdAt,
                  customer: it.customer!,
                  description: it.checkoutId || it.id,
                  refundedDate: it.refunds?.createdAt ?? undefined,
                }))}
                enableBulkSelect={true}
                actions={tableActions}
                isLoading={isLoading}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
              />
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <TransactionsPageContent />
    </React.Suspense>
  );
}
