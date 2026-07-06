"use client";

import * as React from "react";

import { retrieveOrganizations } from "@/actions/organization";
import { retrievePayouts } from "@/actions/payout";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { PayoutReceipt } from "@/components/receipt-engine";
import { PayoutStatus } from "@/constant/schema.client";
import { Payout } from "@/db";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { downloadReceipt } from "@/lib/utils";
import { Badge, Button, DataTable, TableAction, cn, toast } from "@stellartools/shared-ui";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, Construction, Wallet, XCircle } from "lucide-react";
import moment from "moment";
import { useRouter } from "next/navigation";

const StatusBadge = ({ status }: { status: PayoutStatus }) => {
  const config = {
    pending: {
      className: "bg-destructive/10 text-destructive border-destructive/20",
      icon: Clock,
      label: "Pending",
    },
    succeeded: {
      className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      icon: CheckCircle2,
      label: "Succeeded",
    },
    failed: {
      className: "bg-destructive text-destructive-foreground border-destructive",
      icon: XCircle,
      label: "Failed",
    },
  }[status];

  return (
    <Badge variant="outline" className={cn("gap-1.5 border", config.className)}>
      <config.icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

export default function PayoutPage() {
  const router = useRouter();
  const { data: orgContext } = useOrgContext();
  const { data: organizations } = useQuery({
    queryKey: ["sidebar-organizations"],
    queryFn: async () => await retrieveOrganizations(),
  });
  const { data: payoutList = [], isLoading } = useOrgQuery(["payouts"], () => retrievePayouts());

  const currentOrg = organizations?.find((org) => org.id === orgContext?.id) || null;
  const [columnFilters, setColumnFilters] = useSyncTableFilters();

  const columns: ColumnDef<Payout>[] = [
    {
      header: "Date",
      cell: ({ row }) => <div className="text-sm">{moment(row.original.createdAt).format("DD MMM YYYY")}</div>,
      meta: { filterable: true, filterVariant: "date" },
    },
    {
      header: "Method",
      cell: ({
        row: {
          original: { walletAddress, bankAccount },
        },
      }) => (
        <div className="flex items-center gap-2 font-mono text-sm">
          <Wallet className="h-4 w-4" />{" "}
          {walletAddress ? walletAddress.slice(0, 8) : bankAccount ? "Bank Account" : "N/A"}
        </div>
      ),
      meta: { filterable: true, filterVariant: "text" },
    },
    {
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status as PayoutStatus} />,
      meta: {
        filterable: true,
        filterVariant: "select",
        filterOptions: [
          { label: "Pending", value: "pending" },
          { label: "Succeeded", value: "succeeded" },
          { label: "Failed", value: "failed" },
        ],
      },
    },
    {
      header: "Amount",
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.cryptoAmount} {row.original.selectedAssetCode ?? "XLM"}
        </div>
      ),
      meta: { filterable: true, filterVariant: "number" },
    },
  ];

  const tableActions: TableAction<Payout>[] = [
    { label: "View Details", onClick: (row) => router.push(`/payout/${row.id}`) },
    {
      label: "Download Receipt",
      onClick: async (row) => {
        const downloadPromise = downloadReceipt(
          <PayoutReceipt
            payoutId={row.id}
            payoutAmountCents={row.amountCents}
            payoutCurrencyCode={row.currencyCode}
            payoutCryptoAmount={Number(row.cryptoAmount)}
            payoutSelectedAssetCode={row.selectedAssetCode ?? undefined}
            payoutTransactionHash={row.transactionHash ?? undefined}
            payoutCreatedAt={row.createdAt}
            payoutCompletedAt={row.completedAt ?? undefined}
            payoutEnvironment={row.environment}
            payoutWalletAddress={row.walletAddress ?? undefined}
            payoutMemo={row.memo ?? undefined}
            organizationName={currentOrg?.name}
            organizationAddress={currentOrg?.address ?? undefined}
            organizationEmail={currentOrg?.supportEmail ?? undefined}
            organizationLogo={currentOrg?.logoUrl ?? undefined}
          />,
          `receipt-${row.id}.pdf`
        );
        toast.promise(downloadPromise, { loading: "Preparing receipt...", success: "Downloaded", error: "Failed" });
      },
    },
  ];

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-6">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Payout</h1>
            <p className="text-muted-foreground text-sm">Withdraw your earnings to a wallet or bank account</p>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <Construction className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Payout is in development.</span> Requesting payouts will be available
              soon, your payout history is shown below.
            </p>
          </div>

          <DataTable
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            columns={columns}
            data={payoutList}
            actions={tableActions}
            isLoading={isLoading}
            onRowClick={(r) => router.push(`/payout/${r.id}`)}
          />
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
