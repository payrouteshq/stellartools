"use client";

import * as React from "react";

import { retrieveProducts } from "@/actions/product";
import { AppModal } from "@/components/app-modal";
import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DataTable, TableAction } from "@/components/data-table";
import { Spinner } from "@/components/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { stroopsToXlm } from "@/lib/utils";
import { Column, ColumnDef } from "@tanstack/react-table";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Package,
  Plus,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Product, ProductsModalContent, ProductsModalFooter } from "./_shared";

const SortableHeader = ({ column, title }: { column: Column<Product, unknown>; title: string }) => {
  const isSorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      className="hover:text-foreground -mx-2 h-8 gap-2 font-semibold"
      onClick={() => column.toggleSorting(isSorted === "asc")}
    >
      {title}
      {isSorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : isSorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </Button>
  );
};

const StatCard = ({
  label,
  count,
  icon: Icon,
  active,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  active?: boolean;
}) => (
  <Card className="shadow-none">
    <CardContent className="flex items-center justify-between p-5">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold tracking-tight">{count}</p>
      </div>
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? "bg-primary/10" : "bg-muted/50"}`}
      >
        <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      </div>
    </CardContent>
  </Card>
);

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3 py-1">
        <Avatar className="rounded-lg border">
          <AvatarImage src={row.original.images?.[0] ?? ""} alt={row.original.name} className="object-cover" />
          <AvatarFallback className="bg-muted/50 rounded-lg">
            <Package className="text-muted-foreground h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="font-medium">{row.original.name}</div>
      </div>
    ),
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "pricing",
    header: ({ column }) => <SortableHeader column={column} title="Pricing" />,
    cell: ({ row }) => {
      const p = row.original.pricing;
      return (
        <div className="flex flex-col py-1">
          <div className="font-semibold">
            {p.amount} {p.asset}
          </div>
          {p.isRecurring && (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <RefreshCw className="h-3 w-3" /> <span>Per {p.period}</span>
            </div>
          )}
        </div>
      );
    },
    sortingFn: (rowA, rowB) => rowA.original.pricing.amount - rowB.original.pricing.amount,
    meta: { filterable: true, filterVariant: "number" },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column} title="Created" />,
    cell: ({ row }) => (
      <div className="text-muted-foreground font-medium">
        {row.original.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </div>
    ),
    meta: { filterable: true, filterVariant: "date" },
  },
];

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidate = useInvalidateOrgQuery();
  const [selectedStatus, setSelectedStatus] = React.useState<string | null>(null);
  const productModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [productModalFooterProps, setProductModalFooterProps] = React.useState({
    isPending: false,
    isEditMode: false,
  });
  const isProductModalOpenRef = React.useRef(false);

  const openCreateModal = React.useCallback(() => {
    isProductModalOpenRef.current = true;
    setProductModalFooterProps({ isPending: false, isEditMode: false });
    AppModal.open({
      title: "Add a product",
      description: undefined,
      content: (
        <ProductsModalContent
          onClose={AppModal.close}
          onSuccess={() => {
            invalidate(["products"]);
            AppModal.close();
          }}
          setSubmitRef={productModalSubmitRef}
          onFooterChange={(props) => setProductModalFooterProps((prev) => ({ ...prev, ...props }))}
        />
      ),
      footer: (
        <ProductsModalFooter
          onClose={AppModal.close}
          submitRef={productModalSubmitRef}
          isPending={false}
          isEditMode={false}
        />
      ),
      size: "full",
      showCloseButton: true,
      onClose: () => {
        isProductModalOpenRef.current = false;
      },
    });
  }, [invalidate]);

  const openEditModal = React.useCallback(
    (product: Product) => {
      isProductModalOpenRef.current = true;
      setProductModalFooterProps({ isPending: false, isEditMode: true });
      AppModal.open({
        title: "Edit product",
        description: undefined,
        content: (
          <ProductsModalContent
            editingProduct={product}
            onClose={AppModal.close}
            onSuccess={() => {
              invalidate(["products"]);
              AppModal.close();
            }}
            setSubmitRef={productModalSubmitRef}
            onFooterChange={(props) => setProductModalFooterProps((prev) => ({ ...prev, ...props }))}
          />
        ),
        footer: (
          <ProductsModalFooter
            onClose={AppModal.close}
            submitRef={productModalSubmitRef}
            isPending={false}
            isEditMode
          />
        ),
        size: "full",
        showCloseButton: true,
        onClose: () => {
          isProductModalOpenRef.current = false;
        },
      });
    },
    [invalidate]
  );

  React.useEffect(() => {
    if (isProductModalOpenRef.current) {
      AppModal.updateConfig({
        footer: (
          <ProductsModalFooter
            onClose={AppModal.close}
            submitRef={productModalSubmitRef}
            isPending={productModalFooterProps.isPending}
            isEditMode={productModalFooterProps.isEditMode}
          />
        ),
      });
    }
  }, [productModalFooterProps.isPending, productModalFooterProps.isEditMode]);

  React.useEffect(() => {
    if (searchParams?.get("mode") === "create") openCreateModal();
  }, [searchParams?.get("mode"), openCreateModal]);

  const { data: products, isLoading } = useOrgQuery(
    ["products"],
    () => retrieveProducts(undefined, undefined, { status: "active" }),
    {
      select: (productsData) => {
        return productsData.map(({ product, asset }) => {
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            pricing: {
              amount: Number(stroopsToXlm(BigInt(product.priceAmount.toString()))),
              asset: asset.code,
              isRecurring: product.type === "subscription",
              period: product.recurringPeriod!,
            },
            status: product.status,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            type: product.type,
            images: product.images,
            metadata: product.metadata ?? {},
            unit: product.unit ?? null,
            unitsPerCredit: product.unitsPerCredit ?? null,
            assetId: product.assetId ?? null,
          };
        });
      },
    }
  );

  const stats = React.useMemo(
    () => ({
      all: products?.length ?? 0,
      active: products?.filter((p) => p.status === "active").length ?? 0,
      archived: products?.filter((p) => p.status === "archived").length ?? 0,
    }),
    [products]
  );

  const tableActions: TableAction<Product>[] = [
    {
      label: "Edit",
      onClick: openEditModal,
    },
    {
      label: "Archive",
      onClick: (p) => console.log("Archive", p),
      variant: "destructive",
    },
  ];

  const [columnFilters, setColumnFilters] = useSyncTableFilters();

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-8 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Product catalog</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">Manage and organize your product offerings</p>
              </div>
              <Button onClick={openCreateModal} className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" /> Create product
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="All" count={stats.all} icon={Package} />
              <StatCard label="Active" count={stats.active} icon={Package} active />
              <StatCard label="Archived" count={stats.archived} icon={Archive} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {selectedStatus && (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                    Status: <span className="capitalize">{selectedStatus}</span>
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedStatus(null)} />
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" /> Export
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" /> Columns
                </Button>
              </div>
            </div>

            <div className="overflow-hidden">
              <DataTable
                columns={columns}
                data={products!}
                actions={tableActions}
                enableBulkSelect
                isLoading={isLoading}
                onRowClick={(product) => router.push(`/products/${product.id}`)}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
              />
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex w-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <ProductsPageContent />
    </React.Suspense>
  );
}
