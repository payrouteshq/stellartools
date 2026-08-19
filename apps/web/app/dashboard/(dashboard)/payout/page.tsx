"use client";

import React from "react";

import { retrieveOrganizations } from "@/actions/organization";
import { WalletAsset, retrievePayouts, retrieveWalletBalance } from "@/actions/payout";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { PayoutReceipt } from "@/components/receipt-engine";
import { PayoutStatus } from "@/constant/schema.client";
import { COUNTRIES, FIAT_CURRENCIES, PAYOUT_RAILS } from "@/constant/countries";
import { Payout } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { downloadReceipt } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import _ from "lodash";
import {
  AppModal,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  SelectField,
  SelectInput,
  Separator,
  Skeleton,
  Spinner,
  TableAction,
  TextField,
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  cn,
  toast,
} from "@stellartools/shared-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpFromLine,
  CheckCircle2,
  CircleAlert,
  Clock,
  Construction,
  ExternalLink,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
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

type FiatCurrency = "NGN" | "USD" | "GBP" | "EUR";

interface OfframpCapabilities {
  provider: { id: "sdf-test-anchor"; name: string };
  environment: "testnet" | "mainnet";
  sandbox: boolean;
  assets: Array<{
    code: string;
    issuer: string | null;
    minAmount: string | null;
    maxAmount: string | null;
  }>;
  destinationCurrencies: readonly FiatCurrency[];
  payoutRails: readonly ["bank_account"];
}

interface CreateOfframpResponse {
  id: string;
  status: "pending";
  providerTransactionId: string;
  interactiveUrl: string;
  sandbox: boolean;
}

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

  const balanceExceeded = !!selectedAsset && Number(cryptoAmount) > 0 && Number(cryptoAmount) > selectedAsset.balance;
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
      if (!org) throw new AppError("NOT_FOUND", "No organization context");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": org.token! },
      });
      const result = await api.post<{ id: string }>("/payout", data, { "Idempotency-Key": idempotencyKey.current });
      if (result.isErr()) throw new AppError("INTERNAL_ERROR", result.error.message);
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
              className="text-primary cursor-pointer hover:underline"
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

const fiatPayoutSchema = z.object({
  assetCode: z.string().min(1, "Please select an asset"),
  cryptoAmount: z.string().refine((value) => Number(value) > 0, "Enter a valid amount greater than 0"),
  destinationCurrency: z.enum(["NGN", "USD", "GBP", "EUR"]),
  destinationCountry: z
    .string()
    .trim()
    .length(2, "Use a two-letter country code, for example NG")
    .transform((value) => value.toUpperCase()),
  payoutRail: z.literal("bank_account"),
});

type FiatPayoutFormData = z.infer<typeof fiatPayoutSchema>;

function FiatPayoutForm({ assets, onSuccess }: { assets: WalletAsset[]; onSuccess: () => void }) {
  const { data: org } = useOrgContext();
  const idempotencyKey = React.useRef(crypto.randomUUID());
  const popupRef = React.useRef<Window | null>(null);

  const {
    data: capabilities,
    error: capabilitiesError,
    isLoading: isLoadingCapabilities,
    refetch: refetchCapabilities,
  } = useQuery({
    queryKey: ["offramp-capabilities", org?.id],
    enabled: !!org?.token,
    retry: false,
    queryFn: async () => {
      if (!org?.token) throw new AppError("NOT_FOUND", "No organization context");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": org.token },
      });
      const result = await api.get<OfframpCapabilities>("/offramp/capabilities");
      if (result.isErr()) throw new AppError("INTERNAL_ERROR", result.error.message);
      return result.value;
    },
  });

  const availableAssets = React.useMemo(
    () =>
      assets.filter((walletAsset) =>
        capabilities?.assets.some(
          (providerAsset) => providerAsset.code === walletAsset.code && providerAsset.issuer === walletAsset.issuer
        )
      ),
    [assets, capabilities]
  );

  const form = useForm<FiatPayoutFormData>({
    resolver: zodResolver(fiatPayoutSchema),
    defaultValues: {
      assetCode: "",
      cryptoAmount: "",
      destinationCurrency: "NGN",
      destinationCountry: "NG",
      payoutRail: "bank_account",
    },
  });

  React.useEffect(() => {
    if (!form.getValues("assetCode") && availableAssets[0]) {
      form.setValue("assetCode", availableAssets[0].code, { shouldValidate: true });
    }
  }, [availableAssets, form]);

  React.useEffect(() => {
    const supportedCurrencies = capabilities?.destinationCurrencies;
    if (!supportedCurrencies?.length || supportedCurrencies.includes(form.getValues("destinationCurrency"))) return;
    form.setValue("destinationCurrency", supportedCurrencies[0], { shouldValidate: true });
  }, [capabilities?.destinationCurrencies, form]);

  const selectedCode = form.watch("assetCode");
  const cryptoAmount = form.watch("cryptoAmount");
  const selectedAsset = availableAssets.find((asset) => asset.code === selectedCode);
  const providerAsset = capabilities?.assets.find(
    (asset) => asset.code === selectedAsset?.code && asset.issuer === selectedAsset?.issuer
  );
  const numericAmount = Number(cryptoAmount);
  const providerMin = providerAsset?.minAmount ? Number(providerAsset.minAmount) : null;
  const providerMax = providerAsset?.maxAmount ? Number(providerAsset.maxAmount) : null;
  const balanceExceeded = !!selectedAsset && numericAmount > selectedAsset.balance;
  const belowProviderMinimum = providerMin !== null && numericAmount > 0 && numericAmount < providerMin;
  const aboveProviderMaximum = providerMax !== null && numericAmount > providerMax;
  const amountInvalid =
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    balanceExceeded ||
    belowProviderMinimum ||
    aboveProviderMaximum;

  const maximumSelectableAmount = React.useMemo(() => {
    if (!selectedAsset) return null;
    const maximum = providerMax === null ? selectedAsset.balance : Math.min(selectedAsset.balance, providerMax);
    return maximum > 0 ? maximum.toFixed(7) : null;
  }, [providerMax, selectedAsset]);
  const transactionLimitLabel = providerAsset
    ? providerAsset.minAmount && providerAsset.maxAmount
      ? `${providerAsset.minAmount}–${providerAsset.maxAmount} ${selectedCode}`
      : providerAsset.minAmount
        ? `Minimum ${providerAsset.minAmount} ${selectedCode}`
        : providerAsset.maxAmount
          ? `Maximum ${providerAsset.maxAmount} ${selectedCode}`
          : null
    : null;

  const { mutate: createOfframp, isPending } = useAction(
    async (data: FiatPayoutFormData) => {
      if (!org?.token || !capabilities || !selectedAsset) {
        throw new AppError("NOT_FOUND", "Offramp is not available");
      }
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": org.token },
        maxRetries: 0,
      });
      const result = await api.post<CreateOfframpResponse>(
        "/offramp",
        {
          providerId: capabilities.provider.id,
          assetCode: selectedAsset.code,
          assetIssuer: selectedAsset.issuer,
          cryptoAmount: data.cryptoAmount,
          destinationCurrency: data.destinationCurrency,
          destinationCountry: data.destinationCountry,
          payoutRail: data.payoutRail,
        },
        { "Idempotency-Key": idempotencyKey.current }
      );
      if (result.isErr()) throw new AppError("INTERNAL_ERROR", result.error.message);
      return result.value;
    },
    {
      onSuccess: (result) => {
        if (popupRef.current) {
          popupRef.current.opener = null;
          popupRef.current.location.href = result.interactiveUrl;
        }
        onSuccess();
      },
      onError: () => {
        popupRef.current?.close();
        popupRef.current = null;
        idempotencyKey.current = crypto.randomUUID();
      },
      successMsg: "Fiat payout started. Complete the provider flow in the new window.",
    }
  );

  const handleSubmit = form.handleSubmit((data) => {
    if (amountInvalid) return;
    popupRef.current = window.open("/payout/provider-loading", "_blank");
    if (!popupRef.current) {
      toast.error("Your browser blocked the provider window. Allow popups and try again.");
      return;
    }
    createOfframp(data);
  });

  const amountError = balanceExceeded
    ? `Exceeds available balance of ${Money.formatCrypto(selectedAsset?.balance ?? 0, selectedCode)}`
    : belowProviderMinimum
      ? `Minimum provider amount is ${providerAsset?.minAmount} ${selectedCode}`
      : aboveProviderMaximum
        ? `Maximum provider amount is ${providerAsset?.maxAmount} ${selectedCode}`
        : form.formState.errors.cryptoAmount?.message;

  if (org?.environment === "mainnet") {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="bg-amber-500/10 flex size-12 items-center justify-center rounded-full">
          <ShieldCheck className="text-amber-600 size-6" />
        </div>
        <div className="max-w-sm">
          <p className="font-semibold">Fiat offramp payouts are only available in Test Mode</p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            Fiat payout is unavailable at the moment.
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingCapabilities) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-12 text-center">
        <Spinner size={28} />
        <div>
          <p className="text-sm font-medium">Getting your payout options</p>
          <p className="text-muted-foreground mt-1 text-xs">This should only take a moment…</p>
        </div>
      </div>
    );
  }

  if (capabilitiesError) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-full">
          <CircleAlert className="text-destructive size-6" />
        </div>
        <div className="max-w-sm">
          <p className="font-medium">Fiat payouts are temporarily unavailable</p>
          <p className="text-muted-foreground mt-1 text-sm">
            We couldn’t load your payout options. Check your connection and try again.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => void refetchCapabilities()}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-2">
      {capabilities?.sandbox && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Test mode</p>
            <p className="mt-1 text-xs">
              You can complete the full payout flow, but no real fiat will be sent to a bank account.
            </p>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">You send</p>
          <p className="text-muted-foreground mt-1 text-xs">Choose an asset and enter how much you want to cash out.</p>
        </div>
        <SelectInput
          id="fiat-payout-amount"
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
          options={availableAssets.map((asset) => asset.code)}
          optionLabels={Object.fromEntries(
            availableAssets.map((asset) => [
              asset.code,
              `${asset.code} — ${Money.formatCrypto(asset.balance, asset.code)} available`,
            ])
          )}
          error={amountError ?? form.formState.errors.assetCode?.message}
        />

        {selectedAsset && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-muted-foreground">
              Available: {Money.formatCrypto(selectedAsset.balance, selectedAsset.code)}
            </p>
            {maximumSelectableAmount && (
              <button
                type="button"
                className="text-primary cursor-pointer font-medium hover:underline"
                onClick={() =>
                  form.setValue("cryptoAmount", maximumSelectableAmount, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                Max
              </button>
            )}
          </div>
        )}

        {transactionLimitLabel && (
          <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs">
            <span className="text-muted-foreground">Transaction limit</span>
            <span className="font-medium tabular-nums">{transactionLimitLabel}</span>
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">You receive</p>
          <p className="text-muted-foreground mt-1 text-xs">Choose your currency and where you want to receive it.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="destinationCurrency"
            render={({ field, fieldState }) => (
              <SelectField
                id="fiat-currency"
                label="Currency"
                value={field.value}
                onChange={field.onChange}
                items={(capabilities?.destinationCurrencies ?? FIAT_CURRENCIES.map((f) => f.code)).map((currency) => {
                  const match = FIAT_CURRENCIES.find((f) => f.code === currency);
                  return {
                    value: currency,
                    label: match ? match.name : `${currency} — Currency`,
                  };
                })}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="destinationCountry"
            render={({ field, fieldState }) => (
              <SelectField
                id="fiat-country"
                label="Country"
                value={field.value}
                onChange={(code) => {
                  field.onChange(code);
                  const countryObj = COUNTRIES.find((c) => c.code === code);
                  if (countryObj?.currency) {
                    const availableCurrencies = capabilities?.destinationCurrencies ?? FIAT_CURRENCIES.map((f) => f.code);
                    if (availableCurrencies.includes(countryObj.currency as any)) {
                      form.setValue("destinationCurrency", countryObj.currency as any);
                    }
                  }
                }}
                items={COUNTRIES.map((c) => ({
                  value: c.code,
                  label: `${c.name} (${c.code})`,
                }))}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="payoutRail"
          render={({ field, fieldState }) => (
            <SelectField
              id="fiat-payout-rail"
              label="Receive money via"
              value={field.value}
              onChange={field.onChange}
              items={(capabilities?.payoutRails ?? PAYOUT_RAILS.map((r) => r.value)).map((rail) => {
                const match = PAYOUT_RAILS.find((r) => r.value === rail);
                return {
                  value: rail,
                  label: match ? match.label : _.startCase(rail),
                };
              })}
              error={fieldState.error?.message}
            />
          )}
        />
      </section>

      <div className="bg-muted/40 flex items-start gap-3 rounded-xl border p-4">
        <Landmark className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Your details stay with the payout partner</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {capabilities?.provider.name ?? "The payout partner"} will securely collect your bank and identity details
            in the next step. StellarTools does not store them.
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || availableAssets.length === 0 || amountInvalid}
        className="w-full gap-2"
        size="lg"
      >
        {isPending ? <Spinner size={16} strokeColor="currentColor" /> : <ArrowUpFromLine className="size-4" />}
        {isPending ? "Preparing your payout…" : "Continue"}
      </Button>

      {availableAssets.length === 0 && (
        <p className="text-destructive text-center text-sm">
          None of your current wallet assets can be used for a fiat payout.
        </p>
      )}
    </div>
  );
}

function PayoutModalTabs({
  assets,
  publicKey,
  onSuccess,
}: {
  assets: WalletAsset[];
  publicKey: string | null;
  onSuccess: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState("crypto");

  return (
    <UnderlineTabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <UnderlineTabsList>
        <UnderlineTabsTrigger value="crypto">Crypto</UnderlineTabsTrigger>
        <UnderlineTabsTrigger value="fiat">Fiat</UnderlineTabsTrigger>
      </UnderlineTabsList>

      <UnderlineTabsContent value="crypto" className="mt-6">
        <PayoutForm assets={assets} publicKey={publicKey} onSuccess={onSuccess} />
      </UnderlineTabsContent>

      <UnderlineTabsContent value="fiat" className="mt-6">
        <FiatPayoutForm assets={assets} onSuccess={onSuccess} />
      </UnderlineTabsContent>
    </UnderlineTabs>
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
      header: "Crypto",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {Money.formatCrypto(row.original.cryptoAmount, row.original.selectedAssetCode ?? "XLM")}
        </span>
      ),
    },
    {
      header: "Amount",
      cell: ({ row }) => {
        const isPendingProviderQuote =
          row.original.method === "fiat" && row.original.metadata?.amountPendingProviderQuote === true;
        return (
          <div className="font-medium">
            {isPendingProviderQuote
              ? `Pending ${row.original.destinationCurrency ?? row.original.currencyCode} quote`
              : Money.formatFiat(row.original.amountCents, row.original.currencyCode)}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status as PayoutStatus} />,
      meta: {
        filterable: true,
        filterVariant: "multiselect",
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
      description: "Send funds from your account to an external address or bank account.",
      content: (
        <PayoutModalTabs
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
              <span className="font-semibold">Fiat payouts are in test mode.</span> The Fiat tab currently uses the SDF
              Test Anchor and does not send real money. For live withdrawals, continue using crypto and swap on{" "}
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
