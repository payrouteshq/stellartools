"use client";

import * as React from "react";

import { retrieveEvents } from "@/actions/event";
import { retrieveOrganizations } from "@/actions/organization";
import { retrievePayoutById } from "@/actions/payout";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { PayoutReceipt } from "@/components/receipt-engine";
import { TIMELINE_ROUTE_MAP } from "@/constant";
import { PayoutStatus } from "@/constant/schema.client";
import { useAction } from "@/hooks/use-action";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { downloadReceipt } from "@/lib/utils";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  Spinner,
  Timeline,
  cn,
  toast,
  useCopy,
} from "@stellartools/shared-ui";
import { ApiClient } from "@stellartools/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import _ from "lodash";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Landmark,
  LucideIcon,
  MoreHorizontal,
  RefreshCw,
  Wallet,
  XCircle,
} from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const getExplorerUrl = (hash: string, env?: string) =>
  `https://stellar.expert/explorer/${env === "mainnet" ? "public" : "testnet"}/tx/${hash}`;

const StatusBadge = ({ status }: { status: PayoutStatus }) => {
  const config = {
    pending: {
      cls: "bg-destructive/10 text-destructive border-destructive/20",
      icon: Clock,
      label: "Pending",
    },
    succeeded: {
      cls: "bg-green-500/10 text-green-700 border-green-500/20",
      icon: CheckCircle2,
      label: "Succeeded",
    },
    failed: {
      cls: "bg-destructive text-destructive-foreground border-destructive",
      icon: XCircle,
      label: "Failed",
    },
  };
  const { cls, icon: Icon, label } = config[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
};

const CopyBtn = ({ text }: { text: string | null }) => {
  const { copied, handleCopy } = useCopy();

  return text ? (
    <button
      onClick={() => handleCopy({ text, message: "Copied" })}
      className="hover:bg-muted rounded-md p-1 transition-colors"
    >
      {copied ? (
        <CheckMark2 width={16} height={16} className="text-green-600" />
      ) : (
        <Copy className="text-muted-foreground h-4 w-4" />
      )}
    </button>
  ) : null;
};

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  mono?: boolean;
}

const DetailRow = ({ label, value, icon: Icon, action, mono = false }: DetailRowProps) => (
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="text-muted-foreground h-4 w-4 shrink-0" />}
        <span className={cn("text-sm", mono && "font-mono break-all")}>{value}</span>
      </div>
    </div>
    {action}
  </div>
);

export default function PayoutDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { payoutId } = useParams()! as { payoutId: string };
  const { data: orgContext } = useOrgContext();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const { data: organizations } = useQuery({
    queryKey: ["sidebar-organizations"],
    queryFn: async () => await retrieveOrganizations(),
  });

  const {
    data: payout,
    isLoading: isLoadingPayout,
    isFetching,
    refetch: refetchPayout,
  } = useOrgQuery(["payout", payoutId], () => retrievePayoutById(payoutId), {
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 4000 : false),
  });

  const {
    data: payoutEvents,
    isLoading: isLoadingPayoutEvents,
    refetch: refetchPayoutEvents,
  } = useOrgQuery(["payout-events", payoutId], () =>
    retrieveEvents({ payoutId }, ["payout::requested", "payout::processed"])
  );

  const currentOrg = organizations?.find((org) => org.id === orgContext?.id) || null;

  const handleDownloadReceipt = React.useCallback(async () => {
    if (!payout || !currentOrg) return;

    const downloadPromise = downloadReceipt(
      <PayoutReceipt
        payoutId={payout.id}
        payoutAmountCents={payout.amountCents}
        payoutCurrencyCode={payout.currencyCode}
        payoutCryptoAmount={Number(payout.cryptoAmount)}
        payoutSelectedAssetCode={payout.selectedAssetCode ?? undefined}
        payoutTransactionHash={payout.transactionHash ?? undefined}
        payoutCreatedAt={payout.createdAt}
        payoutCompletedAt={payout.completedAt ?? undefined}
        payoutEnvironment={payout.environment}
        organizationName={currentOrg.name}
        organizationAddress={currentOrg?.address ?? undefined}
        organizationEmail={currentOrg?.supportEmail ?? undefined}
        organizationLogo={currentOrg?.logoUrl ?? undefined}
      />,
      `stellartools-payout-receipt-${payout.id}-${moment().format("YYYY-MM-DD")}`
    );

    toast.promise(downloadPromise, {
      loading: "Generating receipt...",
      success: "Receipt downloaded successfully",
      error: "Failed to download receipt",
    });
  }, [payout]);

  const refreshProvider = async () => {
    if (!payout || payout.method !== "fiat") return;
    if (!orgContext?.token) throw new AppError("NOT_FOUND", "No organization context");
    const api = new ApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_URL!,
      headers: { "x-session-token": orgContext.token },
    });
    const result = await api.get<{ providerStatus: string }>(`/offramp/${payout.id}`);
    if (result.isErr()) throw new AppError("INTERNAL_ERROR", result.error.message);
    return result.value;
  };

  const { mutate: confirmFunding, isPending: isConfirmingFunding } = useAction(
    async () => {
      if (!payout || !orgContext?.token) throw new AppError("NOT_FOUND", "No organization context");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token },
      });
      const result = await api.post<{ transactionHash: string | null }>(
        `/offramp/${payout.id}`,
        undefined,
        { "Idempotency-Key": crypto.randomUUID() }
      );
      if (result.isErr()) throw new AppError("INTERNAL_ERROR", result.error.message);
      return result.value;
    },
    {
      onSuccess: async () => {
        try {
          await refreshProvider();
        } catch {}
        await refetchPayout();
        await refetchPayoutEvents();
        queryClient.invalidateQueries({ queryKey: ["payout-events", payoutId] });
        queryClient.invalidateQueries({ queryKey: ["payout", payoutId] });
      },
      successMsg: "Funding payment submitted. The provider is processing your fiat payout.",
    }
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProvider();
      await refetchPayout();
      await refetchPayoutEvents();
      queryClient.invalidateQueries({ queryKey: ["payout-events", payoutId] });
      toast.success("Status refreshed");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh payout status");
    } finally {
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    if (!payout || payout.method !== "fiat" || payout.status !== "pending") return;
    let isCancelled = false;

    const performRefresh = async () => {
      try {
        await refreshProvider();
        if (!isCancelled) {
          await refetchPayout();
          await refetchPayoutEvents();
          queryClient.invalidateQueries({ queryKey: ["payout-events", payoutId] });
        }
      } catch {
        // silent background polling
      }
    };

    performRefresh();
    const interval = setInterval(performRefresh, 4000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [payout?.id, payout?.status, payout?.method]);

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  if (isLoadingPayout) {
    return (
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="py-12 text-center">
            <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    );
  }

  if (!payout)
    return (
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="py-12 text-center">
            <h1 className="text-2xl font-bold">Payout not found</h1>
            <Button onClick={() => router.push("/payout")} className="mt-4">
              Back
            </Button>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    );

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/payout">Payout history</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>Payout {payout.id}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Payout Details</h1>
                <StatusBadge status={payout.status} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-muted-foreground text-sm">Payout #{payout.id}</p>
                {payout.status === "pending" && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                    </span>
                    {isFetching ? "Checking..." : "Auto-updating"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {payout.method === "fiat" &&
                payout.providerStatus === "pending_user_transfer_start" &&
                !payout.transactionHash && (
                  <Button
                    onClick={() => confirmFunding(undefined)}
                    disabled={isConfirmingFunding}
                    className="gap-2"
                  >
                    {isConfirmingFunding ? (
                      <Spinner size={16} strokeColor="currentColor" />
                    ) : (
                      <Landmark className="h-4 w-4" />
                    )}
                    Confirm & Send Funds
                  </Button>
                )}
              <Button variant="outline" onClick={onRefresh} disabled={isRefreshing} className="gap-2 shadow-none">
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} /> Refresh
              </Button>
              <Button variant="outline" onClick={handleDownloadReceipt} className="gap-2 shadow-none">
                <Download className="h-4 w-4" /> Receipt
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shadow-none">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => copyToClipboard(payout.id, "ID Copied")}>Copy ID</DropdownMenuItem>
                  {payout.transactionHash && (
                    <DropdownMenuItem
                      onClick={() => window.open(getExplorerUrl(payout.transactionHash!, payout.environment), "_blank")}
                    >
                      View on Explorer
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                label: "Payout Amount",
                value: `${Money.formatCrypto(Number(payout.cryptoAmount), payout.selectedAssetCode ?? "XLM")}`,
              },
              { label: "Status", value: <StatusBadge status={payout.status} /> },
              {
                label: "Network",
                value: payout.environment === "mainnet" ? "Live Mode" : "Test Mode",
              },
            ].map((card, i) => (
              <div key={i} className="bg-card rounded-lg border p-4">
                <div className="text-muted-foreground mb-1 text-xs">{card.label}</div>
                <div className="text-lg font-bold">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Payout Information</h3>
                <div className="bg-card space-y-4 rounded-lg border p-4">
                  <DetailRow
                    label="Amount"
                    value={`${Money.formatCrypto(Number(payout.cryptoAmount), payout.selectedAssetCode ?? "XLM")}`}
                  />
                  <Separator />
                  <DetailRow
                    label="Payout Method"
                    value={
                      payout.method === "fiat"
                        ? `${payout.withdrawalMethod ?? "Provider payout"} · ${payout.destinationCurrency ?? "Fiat"}`
                        : payout.walletAddress
                    }
                    icon={payout.method === "fiat" ? Landmark : Wallet}
                    mono
                    action={payout.method === "crypto" ? <CopyBtn text={payout.walletAddress} /> : undefined}
                  />
                  {payout.method === "fiat" && (
                    <>
                      <Separator />
                      <DetailRow label="Provider Status" value={_.startCase(payout.providerStatus ?? "initiating")} />
                    </>
                  )}
                  {payout.transactionHash && (
                    <>
                      <Separator />
                      <DetailRow
                        label="Transaction Hash"
                        value={payout.transactionHash}
                        mono
                        action={
                          <div className="flex gap-2">
                            <CopyBtn text={payout.transactionHash} />
                            <ExternalLink
                              className="h-4 w-4 cursor-pointer"
                              onClick={() =>
                                window.open(getExplorerUrl(payout.transactionHash!, payout.environment), "_blank")
                              }
                            />
                          </div>
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Activities</h3>
                <Timeline
                  isLoading={isLoadingPayoutEvents}
                  items={payoutEvents ?? []}
                  renderItem={(evt) => ({
                    title: _.startCase(evt.type.replace(/[::$]/g, " ")),
                    date: moment(evt.createdAt).format("MMM DD, YYYY"),
                    data: evt.data,
                  })}
                  routeMap={TIMELINE_ROUTE_MAP}
                  linkComponent={Link}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Details</h3>
              <div className="space-y-3">
                <DetailRow label="Payout ID" value={payout.id} mono action={<CopyBtn text={payout.id} />} />
                <Separator />
                <DetailRow label="Asset" value={payout.selectedAssetCode ?? "XLM"} />
              </div>
            </div>
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
