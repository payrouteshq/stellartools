"use client";

import * as React from "react";

import { retrieveSupportedAssets } from "@/actions/asset";
import { retrievePayouts } from "@/actions/payout";
import { AppModal } from "@/components/app-modal";
import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DataTable, TableAction } from "@/components/data-table";
import { NumberField } from "@/components/number-field";
import { SelectInput } from "@/components/select+input";
import { Spinner } from "@/components/spinner";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@/components/underline-tabs";
import { PayoutStatus } from "@/constant/schema.client";
import { Payout } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useCurrencyConverter } from "@/hooks/use-currency-converter";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { AppError } from "@/lib/action-handler";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Banknote, CheckCircle2, Clock, ExternalLink, Plus, Wallet, XCircle } from "lucide-react";
import moment from "moment";
import { useRouter } from "next/navigation";
import * as RHF from "react-hook-form";
import { z } from "zod";

import { generateAndDownloadReceipt } from "./_shared";

// --- Constants & Types ---

const SUPPORTED_PAYOUT_COUNTRIES = ["NGN", "GHS"] as const;

type StellarBalance = { balance: string; asset_type: string; asset_code?: string; asset_issuer?: string };
type AnchorTransaction = {
  id: string;
  status: string;
  amount_out?: string;
  amount_out_asset?: string;
  message?: string;
  withdraw_anchor_account?: string;
  withdraw_memo?: string;
};
type AnchorSession = { url: string; id: string; transferServer: string; anchorJwt: string };
type BankStep = "select" | "interactive" | "sending" | "tracking" | "complete";

// --- Components ---

const StatusBadge = ({ status }: { status: PayoutStatus }) => {
  const config = {
    pending: {
      className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
      icon: Clock,
      label: "Pending",
    },
    succeeded: {
      className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      icon: CheckCircle2,
      label: "Succeeded",
    },
    failed: {
      className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
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

const AnchorStatusRow = ({ done, active, label }: { done: boolean; active: boolean; label: string }) => (
  <div className="flex items-center gap-3">
    <div
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
        done ? "border-green-500 bg-green-500/10" : active ? "border-primary bg-primary/10" : "border-border bg-muted"
      )}
    >
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      ) : active ? (
        <Spinner strokeColor="text-primary" size={25} />
      ) : (
        <div className="bg-muted-foreground/30 h-2 w-2 rounded-full" />
      )}
    </div>
    <span className={cn("text-sm", done || active ? "text-foreground font-medium" : "text-muted-foreground")}>
      {label}
    </span>
  </div>
);

// --- Flow Logic ---

function BankPayoutFlow({ onClose, onSuccess, initialCurrencyCode, initialAmount, skipSelectStep }: any) {
  const { data: org } = useOrgContext();
  const { data: productAssets = [] } = useQuery({
    queryKey: ["assets-from-products", org?.id, org?.environment],
    queryFn: () => retrieveSupportedAssets(null, org!.environment),
    enabled: !!org?.id,
  });

  const selectedAsset = productAssets[0];

  // TODO: restore per-asset rateMap when reworking payout page
  const { fiatRates, isLoading: isRatesLoading, currency: selectedCurrency } = useCurrencyConverter();
  const rateMap: Record<string, number> = {};

  const currencyCode = initialCurrencyCode ?? selectedCurrency;
  const [inputValue, setInputValue] = React.useState({ amount: initialAmount ?? "", option: currencyCode });
  const [step, setStep] = React.useState<BankStep>(skipSelectStep && !!initialAmount ? "interactive" : "select");
  const [session, setSession] = React.useState<AnchorSession | null>(null);
  const [anchorTx, setAnchorTx] = React.useState<AnchorTransaction | null>(null);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);

  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const sessionRef = React.useRef<AnchorSession | null>(null);

  const api = new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL!, headers: { "x-session-token": org!.token } });

  const assetAmount = React.useMemo(() => {
    const val = parseFloat(inputValue.amount);
    const rate = rateMap[selectedAsset?.code ?? ""] || 0;
    return val && rate > 0 ? parseFloat((val / rate).toFixed(7)) : null;
  }, [inputValue.amount, selectedAsset, rateMap]);

  const initiateWithdrawal = async () => {
    if (!assetAmount || !selectedAsset) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await api.post<AnchorSession>(`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/~api/anchor/initiate`, {
        assetCode: selectedAsset.code,
        amount: assetAmount.toString(),
      });

      if (response.isErr()) {
        throw new AppError(response.error.message);
      }

      const data = response.value;

      setSession(data);
      sessionRef.current = data;
      setStep("interactive");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pollOnce = async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const response = await api.get<AnchorTransaction>(`${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/~api/anchor/poll`, {
        transferServer: s.transferServer,
        id: s.id,
        anchorJwt: s.anchorJwt,
      });

      if (response.isErr()) {
        throw new AppError(response.error.message);
      }

      const tx = response.value;

      setAnchorTx(tx);
      if (tx.status === "pending_user_transfer_start") {
        stopPolling();
        setStep("sending");

        await api.post<Payout>("/api/payout", {
          amount: assetAmount,
          walletAddress: tx.withdraw_anchor_account,
          memo: tx.withdraw_memo,
          assetId: selectedAsset.id,
        });

        setStep("tracking");
        startPolling();
      } else if (tx.status === "completed") {
        stopPolling();
        setStep("complete");
      } else if (["error", "refunded", "expired"].some((st) => tx.status.includes(st))) {
        stopPolling();
        setError(`Payout failed: ${tx.message ?? tx.status}`);
      }
    } catch {
      /* retry */
    }
  };

  const startPolling = () => {
    stopPolling();
    setIsPolling(true);
    pollIntervalRef.current = setInterval(pollOnce, 5000);
  };
  const stopPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsPolling(false);
  };

  const openAnchorPopup = () => {
    if (!sessionRef.current) return;
    window.open(sessionRef.current.url, "anchor_popup", "width=600,height=700");
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.transaction) startPolling();
    };
    window.addEventListener("message", handleMsg, { once: true });
    startPolling();
  };

  React.useEffect(() => () => stopPolling(), []);
  React.useEffect(() => {
    if (skipSelectStep && !session && !isLoading) initiateWithdrawal();
  }, []);

  // UI Views (Select, Interactive, Sending, Tracking, Complete)
  if (step === "select")
    return (
      <div className="space-y-5">
        <SelectInput
          id="amount"
          label="How much do you want to withdraw?"
          value={inputValue}
          onChange={setInputValue}
          options={fiatRates ? Object.keys(fiatRates).sort() : []}
          isLoading={isRatesLoading}
        />
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={initiateWithdrawal} isLoading={isLoading} disabled={!assetAmount}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );

  if (step === "interactive")
    return (
      <div className="space-y-5">
        <div className="bg-primary/5 flex items-start gap-3 rounded-lg border p-4">
          <ExternalLink className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-xs">
            <p className="text-sm font-semibold">Enter your bank details</p>
            <p className="text-muted-foreground mt-0.5">
              A secure portal will open. Follow the instructions to continue.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <AnchorStatusRow done active={false} label="Connected" />
          <AnchorStatusRow done={false} active={!isPolling} label="Waiting for details..." />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={openAnchorPopup}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open Payout Portal
          </Button>
        </div>
      </div>
    );

  if (step === "tracking")
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <AnchorStatusRow done active={false} label="Funds sent" />
          <AnchorStatusRow done={false} active label={anchorTx?.status || "Processing..."} />
        </div>
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close & Track in Background
        </Button>
      </div>
    );

  if (step === "complete")
    return (
      <div className="space-y-5 py-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <p className="font-semibold">Payout complete!</p>
        <Button className="w-full" onClick={onSuccess}>
          Done
        </Button>
      </div>
    );

  return (
    <div className="flex justify-center py-10">
      <Spinner />
    </div>
  );
}

// --- Modals ---

const requestPayoutSchema = z
  .object({
    paymentMethod: z.enum(["wallet", "bank"]),
    amount: z.number().optional(),
    walletAddress: z.string(),
    memo: z.string().optional(),
    bankAmount: z.string(),
    bankCountry: z.string(),
  })
  .refine((d) => (d.paymentMethod === "bank" ? parseFloat(d.bankAmount) > 0 : (d.amount ?? 0) > 0), {
    message: "Required",
    path: ["amount"],
  });

function RequestPayoutModalContent({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const form = RHF.useForm<z.infer<typeof requestPayoutSchema>>({
    resolver: zodResolver(requestPayoutSchema),
    defaultValues: { paymentMethod: "wallet", bankCountry: "USD" },
  });

  const { data: org } = useOrgContext();
  const method = form.watch("paymentMethod");
  const bankCountry = form.watch("bankCountry");
  const bankAmountStr = form.watch("bankAmount");

  const api = new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL!, headers: { "x-session-token": org!.token } });

  const { data: balances = [] } = useQuery({
    queryKey: ["balance", org?.id],
    queryFn: async () => {
      const response = await api.get<StellarBalance[]>("/api/balance");
      if (response.isErr()) throw new AppError(response.error.message);
      return response.value;
    },
    enabled: !!org && method === "bank",
  });

  const { fiatRates, isLoading: isRatesLoading } = useCurrencyConverter();

  const isBankSupported = SUPPORTED_PAYOUT_COUNTRIES.includes(bankCountry as any);

  const { mutate: requestPayoutAction, isPending: isRequestingPayout } = useAction(
    async (data: any) => {
      await new Promise((r) => setTimeout(r, 1000));
      return data;
    },
    {
      invalidate: ["payouts"],
      successMsg: "Payout requested!",
      errorMsg: "Failed to request payout",
    }
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <UnderlineTabs value={method} onValueChange={(v) => form.setValue("paymentMethod", v as any)}>
        <UnderlineTabsList className="w-full">
          <UnderlineTabsTrigger value="wallet" className="flex-1">
            <Wallet className="mr-2 h-4 w-4" /> Wallet
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger value="bank" className="flex-1">
            <Banknote className="mr-2 h-4 w-4" /> Bank
          </UnderlineTabsTrigger>
        </UnderlineTabsList>

        <UnderlineTabsContent value="wallet" className="mt-6 flex flex-1 flex-col data-[state=inactive]:hidden">
          <div className="flex-1 space-y-5">
            <RHF.Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <NumberField
                  id="amount"
                  label="Amount"
                  value={field.value}
                  onChange={field.onChange}
                  allowDecimal
                  error={fieldState.error?.message}
                />
              )}
            />
            <TextField
              value={form.watch("walletAddress")}
              onChange={(value) => form.setValue("walletAddress", value)}
              error={form.formState.errors.walletAddress?.message}
              id="walletAddress"
              label="Wallet Address"
              placeholder="G..."
            />
            <TextField
              error={form.formState.errors.memo?.message}
              id="memo"
              value={form.watch("memo") ?? ""}
              onChange={(value) => form.setValue("memo", value)}
              label="Memo (Optional)"
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={form.handleSubmit((d) => requestPayoutAction(d))} isLoading={isRequestingPayout}>
              Request Payout
            </Button>
          </div>
        </UnderlineTabsContent>

        <UnderlineTabsContent value="bank" className="mt-6 flex flex-1 flex-col data-[state=inactive]:hidden">
          <div className="space-y-4">
            <SelectInput
              id="bankAmount"
              label="Withdraw amount"
              value={{ amount: bankAmountStr, option: bankCountry }}
              onChange={(v) => {
                form.setValue("bankAmount", v.amount);
                form.setValue("bankCountry", v.option || "USD");
              }}
              options={fiatRates ? Object.keys(fiatRates).sort() : []}
              isLoading={isRatesLoading}
            />
            {!isBankSupported && (
              <p className="text-muted-foreground text-xs">
                Only {SUPPORTED_PAYOUT_COUNTRIES.join(", ")} are currently supported.
              </p>
            )}
          </div>
          {isBankSupported && parseFloat(bankAmountStr) > 0 ? (
            <div className="mt-6 flex-1 border-t pt-6">
              <BankPayoutFlow
                onClose={onClose}
                onSuccess={onSuccess}
                initialCurrencyCode={bankCountry}
                initialAmount={bankAmountStr}
                skipSelectStep
              />
            </div>
          ) : (
            <div className="mt-auto flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled>Continue</Button>
            </div>
          )}
        </UnderlineTabsContent>
      </UnderlineTabs>
    </div>
  );
}

// --- Main Page ---

export default function PayoutPage() {
  const router = useRouter();
  const { data: payoutList = [], isLoading } = useOrgQuery(["payouts"], () => retrievePayouts());

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
        const promise = generateAndDownloadReceipt(row, "StellarTools");
        toast.promise(promise, { loading: "Preparing receipt...", success: "Downloaded", error: "Failed" });
      },
    },
  ];

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Payout history</h1>
              <p className="text-muted-foreground text-sm">Manage store withdrawals</p>
            </div>
            <Button
              onClick={() =>
                AppModal.open({
                  title: "Request Payout",
                  size: "full",
                  showCloseButton: true,
                  content: <RequestPayoutModalContent onClose={AppModal.close} onSuccess={AppModal.close} />,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Request Payout
            </Button>
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
