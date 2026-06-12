"use client";

import * as React from "react";

import { putCreditBalance, retrieveCreditBalances } from "@/actions/credit";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useAction } from "@/hooks/use-action";
import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import {
  AppModal,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DataTable,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Slider,
  TableAction,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Package, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type UsageRecord = {
  id: string;
  customerId: string | null;
  productId: string | null;
  balance: number;
  consumed: number;
  granted: number;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
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

const columns: ColumnDef<UsageRecord>[] = [
  {
    accessorKey: "meteredBilling",
    header: "Metered Billing",
    cell: ({ row }) => {
      const record = row.original;
      const usagePercentage = (Number(record.consumed) / Number(record.granted)) * 100;
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{record.consumed.toLocaleString()}</span>
            <span className="text-muted-foreground text-sm">/ {record.granted.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Slider
              value={[Math.min(usagePercentage, 100)]}
              min={0}
              max={100}
              className="pointer-events-none"
              showKnobs={false}
            />
            <span className="text-muted-foreground text-xs">{usagePercentage.toFixed(1)}%</span>
          </div>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => {
      const customer = row.original.customer;
      if (!customer) return <span className="text-muted-foreground">N/A</span>;
      return (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{customer.name}</span>
          <span className="text-muted-foreground text-sm">{customer.email}</span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => {
      const product = row.original.product;
      return (
        <div className="flex items-center gap-2">
          <Package className="text-muted-foreground h-4 w-4" />
          <span className="text-sm">{product?.name || "Unknown Product"}</span>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const date = row.original.createdAt;
      return (
        <span className="text-sm">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      );
    },
    enableSorting: true,
  },
];

export default function UsagePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const invalidate = useInvalidateOrgQuery();

  const { data: rawBalances = [], isLoading } = useOrgQuery(["credit-balances"], () => retrieveCreditBalances());

  const { mutate: revokeAccess, isPending: isRevoking } = useAction(
    async ({ id, revoke }: { id: string; revoke: boolean }) => {
      await putCreditBalance(id, { isRevoked: revoke });
      return { success: true, revoke };
    },
    {
      invalidate: ["credit-balances"],
      successMsg: "Access revoked successfully",
    }
  );

  const usageRecords: UsageRecord[] = rawBalances.map((b) => ({
    id: b.id,
    customerId: b.customerId,
    productId: b.productId,
    balance: b.balance,
    consumed: b.consumed,
    granted: b.granted,
    isRevoked: b.isRevoked,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    customer: b.customerName ? { id: b.customerId!, name: b.customerName, email: b.customerEmail ?? "" } : undefined,
    product: b.productName ? { id: b.productId!, name: b.productName } : undefined,
  }));

  const filteredRecords = React.useMemo(() => {
    if (!searchQuery.trim()) return usageRecords;

    const query = searchQuery.toLowerCase();
    return usageRecords.filter(
      (record) =>
        record.customer?.name.toLowerCase().includes(query) ||
        record.customer?.email.toLowerCase().includes(query) ||
        record.product?.name.toLowerCase().includes(query) ||
        record.id.toLowerCase().includes(query)
    );
  }, [searchQuery, usageRecords]);

  const tableActions: TableAction<UsageRecord>[] = [
    {
      label: "View Product",
      onClick: (record) => {
        router.push(`/products/${record.productId}`);
      },
    },
    {
      label: "View Customer",
      onClick: (record) => {
        router.push(`/customers/${record.customerId}`);
      },
    },
    {
      label: "View Payment",
      onClick: (record) => {
        router.push(`/transactions?customer=${record.customerId}&paymentId=x`);
      },
    },
    {
      label: "Revoke access",
      onClick: (record) => {
        AppModal.open({
          title: "Revoke access",
          description:
            "This will immediately block the customer from consuming credits for this product. You can restore access at any time from the usage record page.",
          content: (
            <p className="text-muted-foreground text-sm">
              Are you sure you want to revoke access for{" "}
              <span className="text-foreground font-medium">{record.customer?.name ?? record.id}</span>? This action
              takes effect immediately.
            </p>
          ),
          primaryButton: {
            children: "Revoke access",
            variant: "destructive",
            onClick: () => revokeAccess({ id: record.id, revoke: true }),
          },
          secondaryButton: { children: "Cancel" },
          size: "small",
          showCloseButton: false,
        });
      },
      variant: "destructive",
      when: (record) => !record.isRevoked,
    },
    {
      label: "Restore access",
      onClick: (record) => {
        revokeAccess({ id: record.id, revoke: false });
      },
      variant: "destructive",
      when: (record) => record.isRevoked,
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

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">Monitor metered billing and usage records</p>
              </div>
            </div>

            <div className="max-w-md">
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Search className="h-4 w-4" />
                </InputGroupAddon>
                <InputGroupInput
                  type="text"
                  placeholder="Search by customer, email, product, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </div>

            <DataTable
              columns={columns}
              data={filteredRecords}
              actions={tableActions}
              isLoading={isLoading}
              onRowClick={(row) => {
                router.push(`/usage/${row.id}`);
              }}
            />
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
