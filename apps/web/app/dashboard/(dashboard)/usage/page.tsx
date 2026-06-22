"use client";

import * as React from "react";

import { putCreditBalance, retrieveCreditBalances } from "@/actions/credit";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { ResolvedCreditBalance } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import {
  AppModal,
  Avatar,
  AvatarFallback,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  DataTable,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Slider,
  TableAction,
  useCopy,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Copy, ExternalLink, Package, Search, Zap } from "lucide-react";
import Link from "next/link";

const CopyButton = ({ text }: { text: string }) => {
  const { copied, handleCopy } = useCopy();
  return (
    <button
      onClick={() => handleCopy({ text, message: "Copied" })}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <CheckMark2 width={14} height={14} className="text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
};

function getChannelUsagePercent(row: ResolvedCreditBalance): number {
  if (!row.product?.priceCents || !row.latestCumulativeAmount) return 0;
  const maxStroops = (row.product?.priceCents / 100) * 10_000_000;
  if (maxStroops <= 0) return 0;
  return Math.min((Number(row.latestCumulativeAmount) / maxStroops) * 100, 100);
}

function formatStroops(stroops: number): string {
  return (stroops / 10_000_000).toFixed(4) + " USDC";
}

function DetailPanel({
  row,
  onClose,
  onSettle,
  isSettling,
}: {
  row: ResolvedCreditBalance;
  onClose: () => void;
  onSettle: () => void;
  isSettling: boolean;
}) {
  const usagePct = getChannelUsagePercent(row);
  const committedUsdc = Number(row.latestCumulativeAmount ?? 0);
  const maxUsdc = row.product?.priceCents ? (row.product?.priceCents / 100) * 10_000_000 : 0;
  const isSettled = !!row.settledAt;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Customer */}
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {(row.customer?.name ?? "?")
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{row.customer?.name ?? "Unknown"}</p>
          <p className="text-muted-foreground text-sm">{row.customer?.email ?? ""}</p>
        </div>
      </div>

      <Separator />

      {/* Usage meter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Usage</span>
          <span className="font-bold">{usagePct.toFixed(1)}%</span>
        </div>
        <Slider value={[usagePct]} min={0} max={100} showKnobs={false} className="pointer-events-none" />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{formatStroops(committedUsdc)} committed</span>
          <span>{formatStroops(maxUsdc)} total</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Product</p>
            <p className="mt-1 truncate text-sm font-semibold">{row.product?.name ?? "—"}</p>
            {row.product?.unit && <p className="text-muted-foreground text-xs">{row.product?.unit}</p>}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Total Credits</p>
            <p className="mt-1 text-sm font-semibold">{(row.product?.totalCredits ?? 0).toLocaleString()}</p>
            {row.product?.unitsPerCredit && (
              <p className="text-muted-foreground text-xs">{row.product?.unitsPerCredit} units / credit</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel info */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">On-chain Channel</p>
        {row.channelAddress ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground truncate font-mono text-xs">{row.channelAddress}</p>
              <CopyButton text={row.channelAddress} />
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${row.channelAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {row.startLedger && (
              <p className="text-muted-foreground text-xs">Started at ledger {row.startLedger.toLocaleString()}</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Channel not yet deployed</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="font-medium">Balance ID</span>
          <span className="truncate font-mono">{row.id}</span>
          <CopyButton text={row.id} />
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="font-medium">Created</span>
          <span>{new Date(row.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        {isSettled ? (
          <div className="bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-center text-xs">
            Settled{row.settledAt ? ` on ${new Date(row.settledAt).toLocaleDateString()}` : ""}
          </div>
        ) : (
          <Button className="w-full shadow-none" onClick={onSettle} isLoading={isSettling} disabled={isSettling}>
            Settle balance
          </Button>
        )}
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

export default function UsagePage() {
  const { data: orgContext } = useOrgContext();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const { data: rawBalances = [], isLoading } = useOrgQuery(["credit-balances"], () =>
    retrieveCreditBalances(undefined, undefined, undefined, { withProduct: true, withCustomer: true }).then(
      ({ data }) => data
    )
  );

  const { mutate: updateBalance, isPending: isUpdating } = useAction(
    async ({ id, patch }: { id: string; patch: Parameters<typeof putCreditBalance>[1] }) => {
      if (!orgContext?.id || !orgContext?.environment) throw new AppError("No organization context found");
      await putCreditBalance(id, patch, orgContext?.id, orgContext?.environment);
      return { id };
    },
    { invalidate: ["credit-balances"] }
  );

  const selectedRow = selectedId ? (rawBalances.find((b) => b.id === selectedId) ?? null) : null;

  const filteredBalances = React.useMemo(() => {
    if (!searchQuery.trim()) return rawBalances;
    const q = searchQuery.toLowerCase();
    return rawBalances.filter(
      (b) =>
        b.customer?.name?.toLowerCase().includes(q) ||
        b.customer?.email?.toLowerCase().includes(q) ||
        b.product?.name?.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
    );
  }, [searchQuery, rawBalances]);

  const handleSettle = (row: ResolvedCreditBalance) => {
    AppModal.open({
      title: "Settle balance",
      description: "Close this credit balance and mark it as settled.",
      content: (
        <p className="text-muted-foreground text-sm">
          This will settle the balance for{" "}
          <span className="text-foreground font-medium">{row.customer?.name ?? row.id}</span>.
          {row.channelAddress && " The on-chain channel will be closed automatically."}
        </p>
      ),
      primaryButton: {
        children: row.channelAddress ? "Settle & close channel" : "Mark settled",
        onClick: () => updateBalance({ id: row.id, patch: { settledAt: new Date() } }),
      },
      secondaryButton: { children: "Cancel" },
      size: "small",
      showCloseButton: false,
    });
  };

  const columns: ColumnDef<ResolvedCreditBalance>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {(b.customer?.name ?? "?")
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{b.customer?.name ?? "Unknown"}</p>
              <p className="text-muted-foreground truncate text-xs">{b.customer?.email ?? ""}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "product",
      header: "Product",
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex items-center gap-2">
            <Package className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-sm">{b.product?.name ?? "Unknown"}</span>
          </div>
        );
      },
    },
    {
      id: "usage",
      header: "Usage",
      cell: ({ row }) => {
        const b = row.original;
        const pct = getChannelUsagePercent(b);
        const committed = Number(b.latestCumulativeAmount ?? 0);
        return (
          <div className="min-w-[180px] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{formatStroops(committed)} committed</span>
              <span className="font-semibold">{pct.toFixed(1)}%</span>
            </div>
            <Slider value={[pct]} min={0} max={100} showKnobs={false} className="pointer-events-none h-1.5" />
          </div>
        );
      },
    },
    {
      id: "channel",
      header: "Channel",
      cell: ({ row }) => {
        const b = row.original;
        if (b.settledAt)
          return (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              Settled
            </Badge>
          );
        if (b.channelAddress)
          return (
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Zap className="h-3 w-3 text-green-500" />
              Active
            </Badge>
          );
        return (
          <Badge variant="outline" className="text-muted-foreground text-xs">
            Pending
          </Badge>
        );
      },
    },
    {
      id: "date",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
  ];

  const tableActions: TableAction<ResolvedCreditBalance>[] = [
    {
      label: "View details",
      onClick: (row) => setSelectedId(row.id),
    },
    {
      label: "View customer",
      onClick: (row) => row.customerId && window.open(`/customers/${row.customerId}`, "_self"),
    },
    {
      label: "Settle balance",
      onClick: handleSettle,
    },
  ];

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>Usage</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Credit balances and on-chain channel activity across all customers
              </p>
            </div>

            <div className="max-w-sm">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Search className="h-4 w-4" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Search by customer, product, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </div>

            <DataTable
              columns={columns}
              data={filteredBalances}
              actions={tableActions}
              isLoading={isLoading}
              onRowClick={(row) => setSelectedId(row.id)}
            />
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>

      <Sheet open={!!selectedRow} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-[420px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Credit balance details</SheetTitle>
          </SheetHeader>
          {selectedRow && (
            <DetailPanel
              row={selectedRow}
              onClose={() => setSelectedId(null)}
              onSettle={() => handleSettle(selectedRow)}
              isSettling={isUpdating}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
