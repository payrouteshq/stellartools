"use client";

import * as React from "react";

import { retrievePayments } from "@/actions/payment";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { type Payment } from "@/db";
import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import { Money } from "@/lib/money";
import { truncate } from "@/lib/utils";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  Skeleton,
  cn,
  toast,
  useCopy,
} from "@stellartools/shared-ui";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
  Wallet,
  XCircle,
} from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { RefundModalContent, RefundModalFooter } from "../_shared";

const StatusBadge = ({ status }: { status: Payment["status"] | "refunded" }) => {
  const variants = {
    confirmed: {
      className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
      icon: CheckCircle2,
      label: "Confirmed",
    },
    pending: {
      className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
      icon: Clock,
      label: "Pending",
    },
    failed: {
      className: "bg-destructive text-destructive-foreground border-destructive",
      icon: XCircle,
      label: "Failed",
    },
    refunded: {
      className: "bg-muted text-muted-foreground border-border",
      icon: XCircle,
      label: "Refunded",
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

const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const { copied, handleCopy } = useCopy();

  return (
    <button
      onClick={() => handleCopy({ text, message: "Copied to clipboard" })}
      className="hover:bg-muted inline-flex items-center justify-center rounded-md p-1 transition-colors"
      aria-label={label || "Copy to clipboard"}
    >
      {copied ? (
        <CheckMark2 width={16} height={16} className="text-green-600" />
      ) : (
        <Copy className="text-muted-foreground h-4 w-4" />
      )}
    </button>
  );
};

function TransactionDetailSkeleton() {
  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <Skeleton className="h-5 w-48" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="space-y-3">
                <Skeleton className="h-6 w-52" />
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-4 w-full max-w-md" />
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-6 w-20" />
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const { paymentId } = useParams() as { paymentId: string };
  const invalidateOrgQuery = useInvalidateOrgQuery();

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const refundModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [refundModalFooterProps, setRefundModalFooterProps] = React.useState({ isPending: false });
  const isRefundModalOpenRef = React.useRef(false);
  const paymentRef = React.useRef<typeof payment | null>(null);

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

  const openRefundModal = React.useCallback(() => {
    isRefundModalOpenRef.current = true;
    setRefundModalFooterProps({ isPending: false });
    AppModal.open({
      title: "Create Refund",
      description: "Process a refund for a transaction by providing the payment details.",
      content: (
        <RefundModalContent
          payment={paymentRef.current}
          initialPaymentId={paymentId}
          onSuccess={() => {
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
  }, [paymentId]);

  const { data, isLoading, refetch } = useOrgQuery(
    ["payment", paymentId],
    (params) =>
      retrievePayments(
        undefined,
        undefined,
        { paymentId, ...params },
        { withCustomer: true, withWallets: true, withRefunds: true }
      ),
    { enabled: !!paymentId, pagination: true }
  );

  const payment = data?.[0] ?? null;
  paymentRef.current = payment;
  const customer = payment?.customer ?? null;
  const refund = payment?.refunds ?? null;

  const handleRefreshStatus = React.useCallback(async () => {
    if (!paymentId) return;

    setIsRefreshing(true);
    try {
      await invalidateOrgQuery(["payment", paymentId]);
      await refetch();
      toast.success("Transaction status refreshed");
    } catch (error) {
      console.error("Failed to refresh status:", error);
      toast.error("Failed to refresh transaction status");
    } finally {
      setIsRefreshing(false);
    }
  }, [paymentId, invalidateOrgQuery, refetch]);

  const getStellarExplorerUrl = (txHash: string, network: string) => {
    const baseUrl =
      network === "mainnet"
        ? "https://stellar.expert/explorer/public/tx"
        : "https://stellar.expert/explorer/testnet/tx";
    return `${baseUrl}/${txHash}`;
  };

  if (isLoading) {
    return <TransactionDetailSkeleton />;
  }

  if (!payment) {
    return (
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-6">
            <div className="py-12 text-center">
              <h1 className="mb-2 text-2xl font-bold">Transaction not found</h1>
              <p className="text-muted-foreground mb-4">The transaction you&apos;re looking for doesn&apos;t exist.</p>
              <Button onClick={() => router.push("/transactions")}>Back to Transactions</Button>
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    );
  }

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-4 sm:p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/transactions">Transactions</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>{payment.id}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h1 className="text-2xl font-bold sm:text-3xl">Transaction Details</h1>
                    <StatusBadge status={payment?.refunded ? "refunded" : payment.status} />
                  </div>
                  <p className="text-muted-foreground text-sm sm:text-base">{payment.id}</p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    className="w-full gap-2 shadow-none sm:w-auto"
                    onClick={handleRefreshStatus}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    <span>Refresh Status</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="size-8 cursor-pointer shadow-none">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="cursor-pointer" align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          window.open(getStellarExplorerUrl(payment.transactionHash, payment.environment), "_blank");
                        }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View on Stellar Explorer
                      </DropdownMenuItem>
                      {payment.status === "confirmed" && !refund && (
                        <DropdownMenuItem onClick={openRefundModal}>Process Refund</DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          navigator.clipboard.writeText(payment.id);
                          toast.success("Transaction ID copied to clipboard");
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Transaction ID
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold sm:text-xl">Transaction Information</h3>
                  <div className="bg-card space-y-4 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-muted-foreground mb-1 text-xs">Amount</div>

                        <div className="text-2xl font-bold">
                          {Money.formatCrypto(payment.cryptoAmount, payment.selectedAssetCode)}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-muted-foreground mb-1 text-xs">Transaction Hash</div>
                        <div className="font-mono text-sm break-all">{payment.transactionHash}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <CopyButton text={payment.transactionHash} label="Copy transaction hash" />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8"
                          onClick={() => {
                            window.open(getStellarExplorerUrl(payment.transactionHash, payment.environment), "_blank");
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-muted-foreground mb-1 text-xs">Network</div>
                        <div className="text-sm capitalize">{payment.environment}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-muted-foreground mb-1 text-xs">Created At</div>
                        <div className="text-sm">{moment(payment.createdAt).format("MMMM DD, YYYY [at] h:mm A")}</div>
                      </div>
                      <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                    </div>

                    {payment.updatedAt &&
                      new Date(payment.updatedAt).getTime() !== new Date(payment.createdAt).getTime() && (
                        <>
                          <Separator />
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-muted-foreground mb-1 text-xs">Last Updated</div>
                              <div className="text-sm">
                                {moment(payment.updatedAt).format("MMMM DD, YYYY [at] h:mm A")}
                              </div>
                            </div>
                            <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                          </div>
                        </>
                      )}

                    {payment.status === "failed" && payment.failureReason && (
                      <>
                        <Separator />
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-muted-foreground mb-1 text-xs">Failure Reason</div>
                            <div className="text-destructive text-sm">{payment.failureReason}</div>
                          </div>
                          <XCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {refund && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold sm:text-xl">Refund Information</h3>
                    <div className="bg-card space-y-4 rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-muted-foreground mb-1 text-xs">Refund Status</div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1.5 border",
                              refund.status === "succeeded"
                                ? "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
                                : "border-destructive bg-destructive/10 text-destructive"
                            )}
                          >
                            {refund.status === "succeeded" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            <span className="capitalize">{refund.status}</span>
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-muted-foreground mb-1 text-xs">Refund Amount</div>
                          <div className="text-lg font-semibold">
                            {Money.formatCrypto(refund.cryptoAmount, refund.selectedAssetCode)}
                          </div>
                        </div>
                      </div>

                      {refund?.reason && (
                        <>
                          <Separator />
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-muted-foreground mb-1 text-xs">Reason</div>
                              <div className="text-sm">{refund.reason}</div>
                            </div>
                          </div>
                        </>
                      )}

                      {refund.receiverWalletAddress && (
                        <>
                          <Separator />
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-muted-foreground mb-1 text-xs">Receiver Wallet</div>
                              <div className="flex items-center gap-2">
                                <Wallet className="text-muted-foreground h-4 w-4" />
                                <span className="font-mono text-sm break-all">
                                  {truncate(refund.receiverWalletAddress, { start: 6, end: 6 })}
                                </span>
                              </div>
                            </div>
                            <CopyButton text={refund.receiverWalletAddress} label="Copy wallet address" />
                          </div>
                        </>
                      )}

                      {refund.transactionHash && (
                        <>
                          <Separator />
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-muted-foreground mb-1 text-xs">Transaction Hash</div>
                              <div className="font-mono text-sm break-all">{refund.transactionHash}</div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <CopyButton text={refund.transactionHash} label="Copy transaction hash" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  window.open(
                                    getStellarExplorerUrl(refund.transactionHash!, payment.environment),
                                    "_blank"
                                  )
                                }
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}

                      <Separator />

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-muted-foreground mb-1 text-xs">Refunded At</div>
                          <div className="text-sm">{moment(refund.createdAt).format("MMMM DD, YYYY [at] h:mm A")}</div>
                        </div>
                        <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold sm:text-xl">Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-muted-foreground mb-1 text-xs">Transaction ID</div>
                        <div className="font-mono text-sm break-all">{payment.id}</div>
                      </div>
                      <CopyButton text={payment.id} label="Copy transaction ID" />
                    </div>

                    <Separator />

                    {payment.checkoutId && (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-muted-foreground mb-1 text-xs">Checkout ID</div>
                            <div className="font-mono text-sm break-all">{payment.checkoutId}</div>
                          </div>
                          <CopyButton text={payment.checkoutId} label="Copy checkout ID" />
                        </div>

                        <Separator />
                      </>
                    )}

                    {customer && (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-muted-foreground mb-1 text-xs">Customer</div>
                            <div className="text-sm font-medium">{customer.name ?? customer.email ?? "—"}</div>
                            {customer.email && <div className="text-muted-foreground text-xs">{customer.email}</div>}
                          </div>

                          <Link href={`/customers/${customer.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>

                        <Separator />
                      </>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-muted-foreground mb-1 text-xs">Status</div>
                        <StatusBadge status={payment?.refunded ? "refunded" : payment.status} />
                      </div>
                    </div>

                    <Separator />

                    <button
                      className="hover:text-foreground text-muted-foreground flex w-full items-center justify-between gap-2 py-0.5 text-sm transition-colors"
                      onClick={() =>
                        window.open(getStellarExplorerUrl(payment.transactionHash, payment.environment), "_blank")
                      }
                    >
                      <span>View on Stellar Explorer</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </button>

                    {payment.status === "confirmed" && !refund && (
                      <>
                        <Separator />
                        <button
                          className="hover:text-foreground text-muted-foreground flex w-full items-center justify-between gap-2 py-0.5 text-sm transition-colors"
                          onClick={openRefundModal}
                        >
                          <span>Process Refund</span>
                          <Wallet className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
