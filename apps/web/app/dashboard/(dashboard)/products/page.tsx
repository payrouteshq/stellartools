"use client";

import * as React from "react";

import { retrieveProducts } from "@/actions/product";
import {
  type ProductEsque,
  ProductsModalContent,
  ProductsModalFooter,
  msToDisplay,
} from "@/app/dashboard/(dashboard)/products/_shared";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { Money } from "@/lib/money";
import {
  AppModal,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  Spinner,
  TableAction,
} from "@stellartools/shared-ui";
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

const SortableHeader = ({ column, title }: { column: Column<ProductEsque, unknown>; title: string }) => {
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

const staticColumns: ColumnDef<ProductEsque>[] = [
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
  const [selectedStatus, setSelectedStatus] = React.useState<string | null>(null);
  const productModalSubmitRef = React.useRef<(() => void) | null>(null);

  const columns = React.useMemo<ColumnDef<ProductEsque>[]>(
    () => [
      staticColumns[0],
      {
        accessorKey: "priceCents",
        header: ({ column }) => <SortableHeader column={column} title="Pricing" />,
        cell: ({ row }) => {
          const { priceCents, currencyCode } = row.original;
          return (
            <div className="flex flex-col py-1">
              <div className="font-semibold">{priceCents ? Money.formatFiat(priceCents, currencyCode) : "—"}</div>
              {row.original.type === "subscription" && row.original.recurringPeriod && (
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  {row.original.recurringPeriod === "custom" && row.original.customDurationMs ? (
                    (() => {
                      const { qty, unit } = msToDisplay(row.original.customDurationMs);
                      return (
                        <span>
                          Every {qty} {unit}
                          {qty !== 1 ? "s" : ""}
                        </span>
                      );
                    })()
                  ) : (
                    <span>Per {row.original.recurringPeriod}</span>
                  )}
                </div>
              )}
            </div>
          );
        },
        sortingFn: (rowA, rowB) => rowA.original.createdAt.getTime() - rowB.original.createdAt.getTime(),
        meta: { filterable: true, filterVariant: "number" },
      },
      staticColumns[1],
    ],
    []
  );
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
  }, []);

  const openEditModal = React.useCallback((product: ProductEsque) => {
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
            AppModal.close();
          }}
          setSubmitRef={productModalSubmitRef}
          onFooterChange={(props) => setProductModalFooterProps((prev) => ({ ...prev, ...props }))}
        />
      ),
      footer: (
        <ProductsModalFooter onClose={AppModal.close} submitRef={productModalSubmitRef} isPending={false} isEditMode />
      ),
      size: "full",
      showCloseButton: true,
      onClose: () => {
        isProductModalOpenRef.current = false;
      },
    });
  }, []);

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
    (params) => retrieveProducts(undefined, undefined, { status: "active", ...params }).then(({ data }) => data),
    {
      pagination: true,
      select: (products) => {
        return products.map((product): ProductEsque => {
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            priceCents: product.priceCents,
            currencyCode: product.currencyCode,
            status: product.status,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            type: product.type,
            images: product.images,
            metadata: product.metadata ?? {},
            unit: product.unit ?? null,
            recurringPeriod: product.recurringPeriod ?? null,
            customDurationMs: product.customDurationMs ?? null,
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

  const tableActions: TableAction<ProductEsque>[] = [
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
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Product catalog</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">Manage and organize your product offerings</p>
              </div>
              <Button onClick={() => openCreateModal()} className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline!">Create product</span>
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
                  <Download className="h-4 w-4" />
                  <span className="hidden md:inline!">Export</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:inline!">Columns</span>
                </Button>
              </div>
            </div>

            <div className="overflow-hidden">
              <DataTable
                columns={columns}
                data={products ?? []}
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
