"use client";

import * as React from "react";

import { putCreditBalance, retrieveCreditBalanceById, retrieveCreditTransactionsByBalance } from "@/actions/credit";
import { AppModal } from "@/components/app-modal";
import { CodeBlock } from "@/components/code-block";
import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { Log, LogDetailItem, LogDetailSection } from "@/components/log";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { UnderlineTabs, UnderlineTabsList, UnderlineTabsTrigger } from "@/components/underline-tabs";
import { useAction } from "@/hooks/use-action";
import { useCopy } from "@/hooks/use-copy";
import { useOrgQuery } from "@/hooks/use-org-query";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, ChevronRight, Copy, Package, RefreshCw, TrendingDown, TrendingUp, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

type UsageRecordStatus = "granted" | "consumed" | "revoked";

type UsageRecord = {
  id: string;
  organizationId: string;
  customerId: string | null;
  productId: string | null;
  balanceId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  status: UsageRecordStatus;
  customer?: {
    id: string;
    name: string;
    email: string;
  };
  product?: {
    id: string;
    name: string;
  };
};

const TX_TYPE_STATUS: Record<string, UsageRecordStatus> = {
  grant: "granted",
  deduct: "consumed",
  refund: "granted",
};

const StatusBadge = ({ status }: { status: UsageRecordStatus }) => {
  const variants = {
    granted: {
      className: "border-muted bg-muted/50 text-foreground",
      label: "Granted",
      icon: TrendingUp,
    },
    consumed: {
      className: "border-muted bg-muted/50 text-foreground",
      label: "Consumed",
      icon: TrendingDown,
    },
    revoked: {
      className: "border-muted bg-muted/50 text-foreground",
      label: "Revoked",
      icon: TrendingDown,
    },
  };

  const variant = variants[status];
  const Icon = variant.icon;

  return (
    <Badge variant="outline" className={`gap-1.5 ${variant.className}`}>
      <Icon className="h-3 w-3" />
      {variant.label}
    </Badge>
  );
};

const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const { copied, handleCopy } = useCopy();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-8 w-8"
      onClick={() => handleCopy({ text, message: "Copied to clipboard" })}
      title={label || "Copy to clipboard"}
    >
      {copied ? <CheckMark2 width={16} height={16} className="text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
};

const columns: ColumnDef<UsageRecord>[] = [
  {
    accessorKey: "status",
    header: "Transaction",
    cell: ({ row }) => {
      const record = row.original;
      const isPositive = record.amount > 0;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            {isPositive ? (
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={record.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{record.amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const customer = row.original.customer;
      if (!customer) {
        return (
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <User className="text-muted-foreground h-5 w-5" />
            </div>
            <span className="text-muted-foreground text-sm">—</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {customer.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{customer.name}</span>
            <span className="text-muted-foreground truncate text-xs">{customer.email}</span>
          </div>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "product",
    header: "Product",
    cell: ({ row }) => {
      const product = row.original.product;
      if (!product) {
        return (
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Package className="text-muted-foreground h-5 w-5" />
            </div>
            <span className="text-muted-foreground text-sm">—</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <Package className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium">{product.name}</span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "reason",
    header: "Reason",
    cell: ({ row }) => {
      const reason = row.original.reason;
      return (
        <div className="max-w-[200px]">
          <span className="text-muted-foreground line-clamp-2 text-sm">{reason || "—"}</span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => {
      const record = row.original;
      const balanceChange = record.balanceAfter - record.balanceBefore;
      return (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{record.balanceBefore.toLocaleString()}</span>
            <ArrowRight className="text-muted-foreground h-3 w-3" />
            <span className="text-sm font-semibold">{record.balanceAfter.toLocaleString()}</span>
          </div>
          {balanceChange !== 0 && (
            <span className="text-muted-foreground text-xs">{balanceChange.toLocaleString()}</span>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: "Date & Time",
    cell: ({ row }) => {
      const date = row.original.createdAt;
      return (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="text-muted-foreground text-xs">
            {date.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
        </div>
      );
    },
    enableSorting: true,
  },
];

export default function UsageDetailPage() {
  const { id } = useParams()! as { id: string };
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const { data: balance } = useOrgQuery(["credit-balance", id], () => retrieveCreditBalanceById(id));

  const { mutate: restoreAccess, isPending: isRestoring } = useAction(
    async ({ id, revoke }: { id: string; revoke: boolean }) => {
      await putCreditBalance(id, { isRevoked: revoke });
      return { success: true, revoke };
    },
    {
      invalidate: [["credit-balance", id], ["credit-balances"]],
      successMsg: (data) => `Access ${data.revoke ? "revoked" : "restored"} successfully`,
    }
  );

  const { data: rawTransactions = [], isLoading } = useOrgQuery(["credit-transactions", id], () =>
    retrieveCreditTransactionsByBalance(id)
  );

  const records: UsageRecord[] = rawTransactions.map((tx) => ({
    id: tx.id,
    organizationId: tx.organizationId,
    customerId: tx.customerId,
    productId: tx.productId,
    balanceId: tx.balanceId,
    amount: tx.amount,
    balanceBefore: tx.balanceBefore,
    balanceAfter: tx.balanceAfter,
    reason: tx.reason,
    metadata: tx.metadata,
    createdAt: tx.createdAt,
    status: TX_TYPE_STATUS[tx.type] ?? "consumed",
    customer: tx.customerName
      ? { id: tx.customerId!, name: tx.customerName, email: tx.customerEmail ?? "" }
      : undefined,
    product: tx.productName ? { id: tx.productId!, name: tx.productName } : undefined,
  }));

  const filteredRecords = React.useMemo(() => {
    if (statusFilter === "all") return records;
    return records.filter((record) => record.status === statusFilter);
  }, [statusFilter, records]);

  const usageMeter = React.useMemo(() => {
    const granted = balance?.granted ?? 0;
    const consumed = balance?.consumed ?? 0;
    const remaining = balance?.balance ?? 0;
    const usagePercentage = granted > 0 ? (Number(consumed) / Number(granted)) * 100 : 0;
    return { granted, consumed, remaining, usagePercentage: Math.min(usagePercentage, 100) };
  }, [balance]);

  const formatJSON = (obj: object) => {
    return JSON.stringify(obj, null, 2);
  };

  const renderDetail = (record: UsageRecord) => {
    return (
      <div className="flex h-full flex-col">
        <div className="border-border mb-4 flex items-start justify-between border-b pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Usage Record</h3>
            <p className="text-muted-foreground text-sm">
              {record.status === "granted"
                ? "Credit granted"
                : record.status === "consumed"
                  ? "Credit consumed"
                  : "Credit revoked"}
            </p>
          </div>
          <StatusBadge status={record.status} />
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          <LogDetailSection title="Balance Information">
            <div className="space-y-3">
              <LogDetailItem label="Amount" value={record.amount.toLocaleString()} />
              <LogDetailItem label="Balance Before" value={record.balanceBefore.toLocaleString()} />
              <LogDetailItem label="Balance After" value={record.balanceAfter.toLocaleString()} />
              <div className="flex items-center justify-between">
                <LogDetailItem label="Balance ID" value={record.balanceId} />
                <CopyButton text={record.balanceId} label="Copy balance ID" />
              </div>
            </div>
          </LogDetailSection>

          <LogDetailSection title="Customer Information">
            <div className="space-y-3">
              {record.customer ? (
                <>
                  <div className="flex items-center justify-between">
                    <LogDetailItem
                      label="Customer"
                      value={
                        <Link href={`/customers/${record.customerId}`} className="text-primary hover:underline">
                          {record.customer.name}
                        </Link>
                      }
                    />
                    <CopyButton text={record.customerId ?? ""} label="Copy customer ID" />
                  </div>
                  <LogDetailItem label="Email" value={record.customer.email} />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No customer data</p>
              )}
            </div>
          </LogDetailSection>

          <LogDetailSection title="Product Information">
            <div className="space-y-3">
              {record.product ? (
                <div className="flex items-center justify-between">
                  <LogDetailItem
                    label="Product"
                    value={
                      <Link href={`/products/${record.productId}`} className="text-primary hover:underline">
                        {record.product.name}
                      </Link>
                    }
                  />
                  <CopyButton text={record.productId ?? ""} label="Copy product ID" />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No product data</p>
              )}
            </div>
          </LogDetailSection>

          <LogDetailSection title="Record Details">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <LogDetailItem label="Usage ID" value={record.id} />
                <CopyButton text={record.id} label="Copy usage ID" />
              </div>
              <LogDetailItem
                label="Created at"
                value={record.createdAt.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              />
              {record.reason && <LogDetailItem label="Reason" value={record.reason} />}
            </div>
          </LogDetailSection>

          {record.metadata && (
            <LogDetailSection title="Metadata">
              <CodeBlock language="json" showCopyButton={true} maxHeight="300px">
                {formatJSON(record.metadata)}
              </CodeBlock>
            </LogDetailSection>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/usage">Usage</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>Records</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">Usage Records</h1>
                  {balance?.isRevoked && (
                    <Badge variant="destructive" className="text-xs">
                      Revoked
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1.5 text-sm">View usage history and balance changes</p>
              </div>
              {balance?.isRevoked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 shadow-none"
                  onClick={() => {
                    AppModal.open({
                      title: "Restore access",
                      description:
                        "The customer will immediately regain the ability to consume credits for this product.",
                      content: (
                        <p className="text-muted-foreground text-sm">
                          Are you sure you want to restore access to this credit balance?
                        </p>
                      ),
                      primaryButton: {
                        children: "Restore access",
                        onClick: () => restoreAccess({ id, revoke: false }),
                      },
                      secondaryButton: { children: "Cancel" },
                      size: "small",
                      showCloseButton: false,
                    });
                  }}
                  disabled={isRestoring}
                  isLoading={isRestoring}
                >
                  Restore access
                </Button>
              )}
            </div>

            {balance?.isRevoked && (
              <div className="bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3 text-sm">
                <span className="mt-0.5">⚠</span>
                <div>
                  <p className="font-medium">Access revoked</p>
                  <p className="text-destructive/80 mt-0.5">
                    This credit balance has been revoked. The customer cannot consume credits until access is restored.
                    API calls for this balance will be rejected.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-none">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm font-medium">Total Consumed</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{usageMeter.consumed.toLocaleString()}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">of {usageMeter.granted.toLocaleString()} granted</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm font-medium">Remaining Balance</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{usageMeter.remaining.toLocaleString()}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">Available to use</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-sm font-medium">Usage Percentage</p>
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[usageMeter.usagePercentage]}
                        min={0}
                        max={100}
                        className="pointer-events-none"
                        showKnobs={false}
                      />
                      <span className="text-lg font-bold">{usageMeter.usagePercentage.toFixed(1)}%</span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {Number(usageMeter.granted) - Number(usageMeter.consumed) > 0
                        ? `${(Number(usageMeter.granted) - Number(usageMeter.consumed)).toLocaleString()} remaining`
                        : "Fully consumed"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-xs font-medium">Total Records</p>
                    <p className="text-xl font-bold">{filteredRecords.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-xs font-medium">Granted</p>
                    <p className="text-xl font-bold">{filteredRecords.filter((r) => r.status === "granted").length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-xs font-medium">Consumed</p>
                    <p className="text-xl font-bold">{filteredRecords.filter((r) => r.status === "consumed").length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground text-xs font-medium">Revoked</p>
                    <p className="text-xl font-bold">{filteredRecords.filter((r) => r.status === "revoked").length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between gap-4">
              <UnderlineTabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
                <UnderlineTabsList>
                  <UnderlineTabsTrigger value="all">All</UnderlineTabsTrigger>
                  <UnderlineTabsTrigger value="granted">Granted</UnderlineTabsTrigger>
                  <UnderlineTabsTrigger value="consumed">Consumed</UnderlineTabsTrigger>
                  <UnderlineTabsTrigger value="revoked">Revoked</UnderlineTabsTrigger>
                </UnderlineTabsList>
              </UnderlineTabs>
              <Button variant="outline" size="sm" className="gap-2 shadow-none">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="h-[calc(100vh-400px)] min-h-[600px]">
              <Log
                data={filteredRecords}
                columns={columns}
                renderDetail={renderDetail}
                detailPanelWidth={500}
                emptyMessage="No usage records found"
                className="h-full"
                isLoading={isLoading}
              />
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
