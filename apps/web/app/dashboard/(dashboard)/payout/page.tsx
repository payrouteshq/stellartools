"use client";

import React from "react";

import { retrieveOrganizations } from "@/actions/organization";
import { WalletAsset, retrievePayouts, retrieveWalletBalance } from "@/actions/payout";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { PayoutReceipt } from "@/components/receipt-engine";
import { PayoutStatus } from "@/constant/schema.client";
import { Payout } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { downloadReceipt } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import {
  AppModal,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  SelectInput,
  Separator,
  Skeleton,
  Spinner,
  TableAction,
  TextField,
  cn,
  toast,
} from "@stellartools/shared-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpFromLine, CheckCircle2, Clock, Construction, ExternalLink, Wallet, XCircle } from "lucide-react";
import moment from "moment";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

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

function BalanceCard({ code, balance }: { code: string; balance: number }) {
  return (
    <Card className="border-border/60 bg-card rounded-2xl shadow-xs">
      <CardContent className="flex items-start justify-between gap-3 p-6">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{code}</p>
          <p className="text-foreground text-2xl font-bold tracking-tight tabular-nums">
            {Money.formatCrypto(balance, code)}
          </p>
          <p className="text-muted-foreground text-xs">Available balance</p>
        </div>
        <div className="bg-muted/80 flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Wallet className="text-muted-foreground size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceCardSkeleton() {
  return (
    <Card className="border-border/60 rounded-2xl shadow-xs">
      <CardContent className="flex items-start justify-between gap-3 p-6">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="size-10 rounded-xl" />
      </CardContent>
    </Card>
  );
}

const payoutSchema = z.object({
  assetCode: z.string().min(1, "Please select an asset"),
  cryptoAmount: z.string().refine((v) => Number(v) > 0, "Enter a valid amount greater than 0"),
  walletAddress: z.string().min(1, "Destination wallet address is required"),
  memo: z.string().max(28).optional(),
});

type PayoutFormData = z.infer<typeof payoutSchema>;

function PayoutForm({
  assets,
  publicKey,
  onSuccess,
}: {
  assets: WalletAsset[];
  publicKey: string | null;
  onSuccess: () => void;
}) {
  const { data: org } = useOrgContext();
  const idempotencyKey = React.useRef(crypto.randomUUID());

  const form = useForm<PayoutFormData>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { assetCode: assets[0]?.code ?? "", cryptoAmount: "", walletAddress: "", memo: "" },
  });

  const selectedCode = form.watch("assetCode");
  const cryptoAmount = form.watch("cryptoAmount");
  const selectedAsset = assets.find((a) => a.code === selectedCode);

  const assetOptions = assets.map((a) => a.code);
  const assetOptionLabels = Object.fromEntries(
    assets.map((a) => [a.code, `${a.code} — ${Money.formatCrypto(a.balance, a.code)} available`])
  );

  const balanceExceeded =
    !!selectedAsset && Number(cryptoAmount) > 0 && Number(cryptoAmount) > selectedAsset.balance;
  const amountError = balanceExceeded
    ? `Exceeds available balance of ${Money.formatCrypto(selectedAsset!.balance, selectedCode)}`
    : (form.formState.errors.cryptoAmount?.message ?? form.formState.errors.assetCode?.message);

  const { mutate: submitPayout, isPending } = useAction(
    async (data: {
      walletAddress: string;
      assetCode: string;
      assetIssuer: string | null;
      cryptoAmount: string;
      memo: string | null;
    }) => {
      if (!org) throw new AppError("No organization context");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": org.token! },
      });
      const result = await api.post<{ id: string }>("/payout", data, { "Idempotency-Key": idempotencyKey.current });
      if (result.isErr()) throw new AppError(result.error.message);
      return result.value;
    },
    { onSuccess, successMsg: "Payout submitted successfully" }
  );

  const handleSubmit = form.handleSubmit((data) => {
    if (balanceExceeded) return;
    submitPayout({
      walletAddress: data.walletAddress,
      assetCode: data.assetCode,
      assetIssuer: selectedAsset?.issuer ?? null,
      cryptoAmount: data.cryptoAmount,
      memo: data.memo?.trim() || null,
    });
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 py-2">
      {publicKey && (
        <div className="bg-muted/50 flex items-center gap-3 rounded-xl border p-4">
          <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-full border shadow-xs">
            <Wallet className="text-muted-foreground size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Sending from</p>
            <p className="font-mono text-sm font-medium">
              {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">Amount</p>
        <SelectInput
          id="payout-amount"
          mode="plain"
          placeholder="0.0000000"
          value={{ amount: cryptoAmount, option: selectedCode }}
          onChange={({ amount, option }) => {
            if (option !== selectedCode) {
              form.setValue("assetCode", option, { shouldValidate: true });
              form.setValue("cryptoAmount", "", { shouldValidate: false });
            } else {
              form.setValue("cryptoAmount", amount, { shouldValidate: true });
            }
          }}
          options={assetOptions}
          optionLabels={assetOptionLabels}
          error={amountError}
        />
        {selectedAsset && (
          <p className="text-muted-foreground text-xs">
            Available: {Money.formatCrypto(selectedAsset.balance, selectedCode)}
            {" · "}
            <button
              type="button"
              className="text-primary hover:underline cursor-pointer"
              onClick={() => form.setValue("cryptoAmount", selectedAsset.balance.toFixed(7), { shouldValidate: true })}
            >
              Max
            </button>
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">Destination</p>
        <Controller
          control={form.control}
          name="walletAddress"
          render={({ field, fieldState }) => (
            <TextField
              id="payout-wallet"
              label="Wallet Address"
              value={field.value}
              onChange={field.onChange}
              placeholder="G..."
              className="font-mono"
              error={fieldState.error?.message}
              helpText="Must be a valid Stellar public key (starts with G)"
            />
          )}
        />
        <Controller
          control={form.control}
          name="memo"
          render={({ field }) => (
            <TextField
              id="payout-memo"
              label={
                <span className="flex items-center gap-1.5">
                  Memo
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </span>
              }
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder="Optional · max 28 characters"
              maxLength={28}
              error={null}
              helpText="Exchanges like Binance provide a memo with their deposit address — required to credit your account"
            />
          )}
        />
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || assets.length === 0}
        className="w-full gap-2"
        size="lg"
      >
        {isPending ? <Spinner size={16} strokeColor="currentColor" /> : <ArrowUpFromLine className="size-4" />}
        {isPending ? "Processing..." : "Submit Payout"}
      </Button>
    </div>
  );
}

export default function PayoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: orgContext } = useOrgContext();

  const { data: organizations } = useQuery({
    queryKey: ["sidebar-organizations"],
    queryFn: async () => await retrieveOrganizations(),
  });

  const { data: payoutList = [], isLoading } = useOrgQuery(["payouts"], () => retrievePayouts());
  const { data: walletData, isLoading: isLoadingBalance } = useOrgQuery(["wallet-balance"], () =>
    retrieveWalletBalance()
  );

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
          {walletAddress
            ? walletAddress.slice(0, 8) + "..." + walletAddress.slice(-4)
            : bankAccount
              ? "Bank Account"
              : "N/A"}
        </div>
      ),
      meta: { filterable: true, filterVariant: "text" },
    },
    {
      header: "Asset",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.original.selectedAssetCode ?? "XLM"}</span>
      ),
    },
    {
      header: "Amount",
      cell: ({ row }) => (
        <div className="font-medium">
          {Money.formatCrypto(Number(row.original.cryptoAmount), row.original.selectedAssetCode ?? "XLM")}
        </div>
      ),
      meta: { filterable: true, filterVariant: "number" },
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

  const openPayoutModal = () => {
    AppModal.open({
      title: "Request Payout",
      description: "Send crypto directly from your Stellar wallet to any external address.",
      content: (
        <PayoutForm
          assets={walletData?.assets ?? []}
          publicKey={walletData?.publicKey ?? null}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["payouts"] });
            queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
            AppModal.close();
          }}
        />
      ),
      size: "full",
      showCloseButton: true,
    });
  };

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Payout</h1>
              <p className="text-muted-foreground mt-1 text-sm">Withdraw your earnings to a Stellar wallet</p>
            </div>
            <Button className="gap-2 sm:shrink-0" onClick={openPayoutModal} disabled={isLoadingBalance}>
              <ArrowUpFromLine className="size-4" />
              <span className="hidden md:inline!">Request Payout</span>
            </Button>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <Construction className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Fiat payouts are coming soon.</span> For now, you can send crypto to your
              personal wallet and swap to fiat on a DEX like{" "}
              <a
                href="https://stellarterm.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2"
              >
                StellarTerm
                <ExternalLink className="size-3" />
              </a>{" "}
              or{" "}
              <a
                href="https://aqua.network"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2"
              >
                Aqua
                <ExternalLink className="size-3" />
              </a>
              .
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoadingBalance ? (
              <>
                <BalanceCardSkeleton />
                <BalanceCardSkeleton />
              </>
            ) : walletData?.assets && walletData.assets.length > 0 ? (
              walletData.assets.map((asset) => (
                <BalanceCard key={asset.code} code={asset.code} balance={asset.balance} />
              ))
            ) : (
              <div className="border-border/60 bg-card col-span-full flex items-center gap-3 rounded-2xl border p-6">
                <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Wallet className="text-muted-foreground size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">No wallet configured</p>
                  <p className="text-muted-foreground text-xs">
                    Set up your Stellar wallet in Settings to view balances.
                  </p>
                </div>
              </div>
            )}
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
