"use client";

import * as React from "react";

import { retrieveCustomers } from "@/actions/customers";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Customer, ResolvedCustomer } from "@/db";
import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { truncate } from "@/lib/utils";
import { AppModal, Avatar, AvatarFallback, AvatarImage, Button, cn, DataTable, TableAction } from "@stellartools/shared-ui";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, CloudUpload, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { CustomerModalContent, ImportCsvModalContent } from "./_shared";

function SortableHeader({
  column,
  label,
  ariaLabelPrefix,
}: {
  column: Column<Customer, unknown>;
  label: string;
  ariaLabelPrefix: string;
}) {
  const isSorted = column.getIsSorted();
  return (
    <Button
      className="hover:text-foreground focus-visible:ring-ring -mx-1 flex items-center gap-2 rounded-sm px-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      aria-label={`${ariaLabelPrefix} ${isSorted === "asc" ? "descending" : "ascending"}`}
    >
      <span>{label}</span>
      {isSorted === "asc" ? (
        <ArrowUp className="ml-1 h-4 w-4" aria-hidden />
      ) : isSorted === "desc" ? (
        <ArrowDown className="ml-1 h-4 w-4" aria-hidden />
      ) : (
        <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" aria-hidden />
      )}
    </Button>
  );
}

const columns: ColumnDef<ResolvedCustomer>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} label="Customer" ariaLabelPrefix="Sort by name" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="border-border h-8 w-8 shrink-0 rounded-full border text-xs">
          {row.original.image ? (
            <AvatarImage className="object-cover" src={row.original.image} alt={row.original.name ?? "Customer"} />
          ) : (
            <AvatarFallback>{row.original.name?.[0] ?? "?"}</AvatarFallback>
          )}
        </Avatar>
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
    enableSorting: true,
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "email",
    header: ({ column }) => <SortableHeader column={column} label="Email" ariaLabelPrefix="Sort by email" />,
    cell: ({ row }) => <div className="text-muted-foreground">{row.original.email}</div>,
    enableSorting: true,
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => <div className="text-muted-foreground">{row.original.phone}</div>,
    meta: { filterable: true, filterVariant: "number" },
  },
  {
    accessorKey: "walletAddress",
    header: ({ column }) => (
      <SortableHeader column={column} label="Wallet Address" ariaLabelPrefix="Sort by wallet address" />
    ),
    cell: ({ row }) => (
      <div className="text-muted-foreground font-mono text-sm">
        {truncate(row.original.wallets?.[0]?.address ?? "-")}
      </div>
    ),
    enableSorting: true,
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column} label="Created" ariaLabelPrefix="Sort by created date" />,
    cell: ({ row }) => {
      const date = row.original.createdAt;
      return (
        <div className="text-muted-foreground">
          {date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          {date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </div>
      );
    },
    enableSorting: true,
    meta: { filterable: true, filterVariant: "date" },
  },
];

const filterMap: Record<number, string> = {
  0: "All",
  1: "First-time customers",
  2: "Recent customers",
};

const filterOptions = [0, 1, 2];

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const [selectedFilter, setSelectedFilter] = React.useState<number>(0);
  const router = useRouter();
  const [columnFilters, setColumnFilters] = useSyncTableFilters();
  const invalidate = useInvalidateOrgQuery();

  const { data: customers, isLoading: isLoadingCustomers } = useOrgQuery(["customers"], () => retrieveCustomers());

  const openCreateModal = React.useCallback(() => {
    AppModal.open({
      title: "Create customer",
      description: "Add a new customer to your organization",
      content: <CustomerModalContent onClose={AppModal.close} onSuccess={() => AppModal.close()} />,
      footer: null,
      size: "full",
      showCloseButton: true,
    });
  }, [invalidate]);

  const openImportModal = React.useCallback(() => {
    AppModal.open({
      title: "Import Customers",
      description: "Map CSV columns to system fields or shrink them into metadata.",
      content: <ImportCsvModalContent onClose={AppModal.close} onSuccess={() => AppModal.close()} />,
      footer: null,
      size: "full",
      showCloseButton: true,
    });
  }, [invalidate]);

  React.useEffect(() => {
    if (searchParams?.get("mode") === "create") openCreateModal();
  }, [searchParams?.get("mode"), openCreateModal]);

  const handleRowClick = (customer: Customer) => {
    router.push(`/customers/${customer.id}`);
  };

  const tableActions: TableAction<Customer>[] = [
    {
      label: "Create invoice",
      onClick: (customer) => {
        console.log("Create invoice for:", customer);
      },
    },
    {
      label: "Create subscription",
      onClick: (customer) => {
        console.log("Create subscription for:", customer);
      },
    },
  ];

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Customers</h1>
                <div className="flex items-center gap-2">
                  <Button className="gap-2 shadow-none" variant="outline" onClick={openImportModal}>
                    <CloudUpload className="h-4 w-4" />
                    Import CSV
                  </Button>
                  <Button className="gap-2 shadow-none" onClick={openCreateModal}>
                    <Plus className="h-4 w-4" />
                    Add customer
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {filterOptions.map((filterIndex) => (
                  <Button
                    key={filterIndex}
                    onClick={() => setSelectedFilter(filterIndex)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                      selectedFilter === filterIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {filterMap[filterIndex]}
                  </Button>
                ))}
              </div>
            </div>

            <DataTable
              columns={columns}
              data={customers?.data ?? []}
              enableBulkSelect={true}
              actions={tableActions}
              onRowClick={handleRowClick}
              isLoading={isLoadingCustomers}
              columnFilters={columnFilters}
              setColumnFilters={setColumnFilters}
            />
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
