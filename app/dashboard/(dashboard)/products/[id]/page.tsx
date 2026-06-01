"use client";

import * as React from "react";

import { retrieveProducts } from "@/actions/product";
import { AppModal } from "@/components/app-modal";
import { CodeBlock } from "@/components/code-block";
import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { CheckMark2 } from "@/components/icon";
import { LogDetailItem } from "@/components/log";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { useCopy } from "@/hooks/use-copy";
import { useInvalidateOrgQuery, useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { stroopsToXlm } from "@/lib/utils";
import { ApiClient } from "@stellartools/core";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight, Copy, Edit, ExternalLink, MoreHorizontal, Package, Pencil } from "lucide-react";
import moment from "moment";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { type Product, ProductsModalContent, ProductsModalFooter } from "../_shared";

const productTypeLabels: Record<string, string> = {
  one_time: "One-off",
  subscription: "Recurring",
  metered: "Metered (Credits)",
};

const recurringPeriodLabels: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

const CopyButton = ({ text, label }: { text: string; label?: string }) => {
  const { copied, handleCopy } = useCopy();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-8 w-8 shrink-0"
      onClick={() => handleCopy({ text, message: "Copied to clipboard" })}
      title={label ?? "Copy"}
    >
      {copied ? (
        <CheckMark2 width={16} height={16} className="text-green-600" />
      ) : (
        <Copy className="text-muted-foreground h-4 w-4" />
      )}
    </Button>
  );
};

function ProductDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/products">Products</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <Skeleton className="h-5 w-32" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>

      <Separator />

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          <section>
            <Skeleton className="mb-3 h-4 w-16" />
            <div className="border-border overflow-hidden rounded-lg border">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </section>
          <section>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="mb-3 h-4 w-full" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </section>
          <section>
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
          </section>
        </div>
        <div className="space-y-8 lg:col-span-2">
          <section>
            <Skeleton className="mb-3 h-4 w-16" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </section>
          <section>
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="h-8 w-full" />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { data: org } = useOrgContext();
  const invalidate = useInvalidateOrgQuery();
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);
  const productModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [productModalFooterProps, setProductModalFooterProps] = React.useState({
    isPending: false,
    isEditMode: true,
  });
  const isProductModalOpenRef = React.useRef(false);

  const { data: product, isLoading } = useOrgQuery(
    ["products", id],
    () => retrieveProducts(undefined, undefined, { productId: id }),
    {
      select: (data) => {
        const first = data[0];
        if (!first) return null;
        return {
          ...first.product,
          assetCode: first.asset.code,
        };
      },
    }
  );

  const isMetered = product?.type === "metered";
  const isSubscription = product?.type === "subscription";

  const formatDate = (date: any) => (date ? moment(date).format("MMM D, YYYY, h:mm A") : "—");

  const createdAtLabel = formatDate(product?.createdAt);
  const updatedAtLabel = formatDate(product?.updatedAt);

  const formatCurrency = (amt: any, code: any) =>
    `${Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code ?? "XLM"}`;

  const mainPriceDisplay = product
    ? isMetered
      ? "Usage-based"
      : formatCurrency(Number(stroopsToXlm(BigInt(product.priceAmount.toString()))), product.assetCode)
    : "";

  const openEditModal = React.useCallback(() => {
    if (!product) return;

    const productForModal: Product = {
      ...product,
      description: product.description ?? null,
      images: product.images ?? [],
      metadata: product.metadata ?? {},
      pricing: {
        amount: Number(product.priceAmount),
        asset: product.assetCode ? `${product.assetCode}:${product.assetId}` : product.assetId,
        isRecurring: product.type === "subscription",
        period: product.recurringPeriod ?? undefined,
      },
      unit: product.unit ?? null,
      unitsPerCredit: product.unitsPerCredit ?? null,
      totalCredits: product.totalCredits ?? null,
      assetId: product.assetId ?? null,
    };

    isProductModalOpenRef.current = true;
    setProductModalFooterProps({ isPending: false, isEditMode: true });
    AppModal.open({
      title: "Edit product",
      content: (
        <ProductsModalContent
          editingProduct={productForModal}
          onClose={AppModal.close}
          onSuccess={() => {
            invalidate(["products", id]);
            invalidate(["products"]);
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
  }, [product, id, invalidate]);

  React.useEffect(() => {
    if (!isProductModalOpenRef.current) return;
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
  }, [productModalFooterProps.isPending, productModalFooterProps.isEditMode]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!org?.token) throw new AppError("No session token");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": org.token },
      });
      if (!product?.organizationId) throw new AppError("Product not found");
      const response = await api.delete<null>(`/product/${id}`);
      if (response.isErr()) throw new AppError(response.error.message);
      return response.value;
    },
    onSuccess: () => {
      invalidate(["products"]);
      toast.success("Product deleted");
      router.push("/products");
      AppModal.close();
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to delete product"),
  });

  const openDeleteModal = React.useCallback(() => {
    if (!product) return;
    AppModal.open({
      title: "Delete product",
      description: "This product will be permanently removed. This action cannot be undone.",
      content: null,
      size: "medium",
      showCloseButton: true,
      primaryButton: {
        children: deleteMutation.isPending ? "Deleting…" : "Delete",
        variant: "destructive",
        onClick: () => deleteMutation.mutate(),
        disabled: deleteMutation.isPending,
      },
      secondaryButton: { children: "Cancel" },
    });
  }, [product, deleteMutation]);

  if (isLoading) {
    return (
      <div className="w-full">
        <DashboardSidebar>
          <DashboardSidebarInset>
            <ProductDetailSkeleton />
          </DashboardSidebarInset>
        </DashboardSidebar>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="w-full">
        <DashboardSidebar>
          <DashboardSidebarInset>
            <div className="flex flex-col gap-6 p-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/products">Products</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Product not found</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Package className="text-muted-foreground h-12 w-12" />
                <h2 className="text-xl font-semibold">Product not found</h2>
                <p className="text-muted-foreground text-center text-sm">
                  The product you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
                </p>
                <Button asChild variant="outline">
                  <Link href="/products">Back to products</Link>
                </Button>
              </div>
            </div>
          </DashboardSidebarInset>
        </DashboardSidebar>
      </div>
    );
  }

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/products">Products</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>{product.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-muted/50 flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border">
                  {product.images?.[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      width={56}
                      height={56}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <Package className="text-muted-foreground h-7 w-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
                    <Badge
                      variant="outline"
                      className={
                        product.status === "active"
                          ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                          : "border-muted bg-muted/50 text-muted-foreground"
                      }
                    >
                      {product.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {productTypeLabels[product.type] ?? product.type}
                    {isSubscription && product.recurringPeriod && (
                      <>
                        {" "}
                        · Billed{" "}
                        {recurringPeriodLabels[product.recurringPeriod]?.toLowerCase() ?? product.recurringPeriod}
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{mainPriceDisplay}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={openEditModal}>
                  <Edit className="h-4 w-4" />
                  Edit product
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Archive product</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => openDeleteModal()}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <Separator />

            <div className="grid gap-8 lg:grid-cols-5">
              <div className="space-y-8 lg:col-span-3">
                <section>
                  <div className="flex items-center justify-between">
                    <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">Pricing</h2>
                  </div>
                  <div className="border-border mt-3 overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-medium">Price</TableHead>
                          <TableHead className="font-medium">Description</TableHead>
                          {isSubscription && <TableHead className="font-medium">Subscriptions</TableHead>}
                          <TableHead className="font-medium">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">
                            {formatCurrency(
                              Number(stroopsToXlm(BigInt(product.priceAmount.toString()))),
                              product.assetCode
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                            {product.description ?? "—"}
                          </TableCell>
                          {isSubscription && (
                            <TableCell className="text-muted-foreground text-sm">
                              {product.recurringPeriod ? recurringPeriodLabels[product.recurringPeriod] : "—"}
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground text-sm">{createdAtLabel}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">Cross-sells</h2>
                    <Badge variant="secondary" className="text-foreground font-normal">
                      Coming soon
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Suggest a related product for customers to add to their order, right in Checkout.{" "}
                    <Link
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-0.5 font-medium hover:underline"
                    >
                      Learn more
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </p>
                  <div className="mt-3">
                    <Input placeholder="Find a product..." disabled className="bg-muted/30 h-10 rounded-lg border" />
                  </div>
                </section>

                <section>
                  <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">Features</h2>
                  <div className="border-border bg-muted/5 mt-3 flex min-h-[120px] items-center justify-center rounded-lg border border-dashed">
                    <p className="text-muted-foreground text-sm">No features</p>
                  </div>
                </section>
              </div>

              <div className="space-y-8 lg:col-span-2">
                <section>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">Details</h2>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openEditModal}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit details</span>
                    </Button>
                  </div>
                  <div className="mt-3 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <LogDetailItem label="Product ID" value={product.id} />
                      <CopyButton text={product.id} label="Copy product ID" />
                    </div>
                    {product.description && (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs font-medium">Description</span>
                        <p className="text-sm">{product.description}</p>
                      </div>
                    )}
                    <div className="border-border border-t border-dashed pt-3">
                      <span className="text-muted-foreground text-xs font-medium">Attributes</span>
                      <p className="text-muted-foreground mt-1 text-sm">—</p>
                    </div>
                    <button
                      type="button"
                      className="text-primary text-xs font-medium hover:underline"
                      onClick={() => setDetailsExpanded((e) => !e)}
                    >
                      {detailsExpanded ? "View less" : "View more"}
                    </button>
                    {detailsExpanded && (
                      <div className="space-y-2 pt-2">
                        <LogDetailItem label="Type" value={productTypeLabels[product.type] ?? product.type} />
                        <LogDetailItem label="Status" value={product.status} />
                        <LogDetailItem label="Environment" value={product.environment} />
                        <LogDetailItem label="Created" value={createdAtLabel} />
                        <LogDetailItem label="Updated" value={updatedAtLabel} />
                      </div>
                    )}
                  </div>
                </section>

                {/* Metadata */}
                <section>
                  <div className="flex items-center gap-2">
                    <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">Metadata</h2>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openEditModal}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit metadata</span>
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    <LogDetailItem
                      label="Type"
                      value={(product.metadata as Record<string, string>)?.["tier"] ?? product.type}
                    />
                    {product.metadata && Object.keys(product.metadata).length > 0 && (
                      <CodeBlock language="json" showCopyButton maxHeight="160px">
                        {JSON.stringify(product.metadata, null, 2)}
                      </CodeBlock>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
