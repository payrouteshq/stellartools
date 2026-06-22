"use client";

import * as React from "react";

import { retrieveCustomers } from "@/actions/customers";
import { retrieveEvents } from "@/actions/event";
import { retrievePayments } from "@/actions/payment";
import { retrieveProducts } from "@/actions/product";
import { CustomerModalContent } from "@/app/dashboard/(dashboard)/customers/_shared";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CheckMark2, Stellar } from "@/components/icon";
import { TIMELINE_ROUTE_MAP } from "@/constant";
import { Payment, ResolvedPayment } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useCurrencyConverter } from "@/hooks/use-currency-converter";
import { useInvalidateOrgQuery, useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient, Checkout } from "@stellartools/core";
import {
  AppModal,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  CodeBlock,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SelectField,
  Separator,
  Skeleton,
  TableAction,
  TextAreaField,
  TextField,
  Timeline,
  cn,
  toast,
  useCopy,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import _ from "lodash";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Edit,
  Eye,
  EyeOff,
  Link2,
  MoreHorizontal,
  XCircle,
} from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as RHF from "react-hook-form";
import { z } from "zod";

import { RefundModalContent, RefundModalFooter } from "../../transactions/_shared";

// --- Reusable Internal Components ---

const paymentStatusVariants = {
  confirmed: {
    cls: "bg-green-500/10 text-green-700 border-green-500/20",
    icon: CheckCircle2,
    label: "Confirmed",
  },
  pending: {
    cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
    icon: Clock,
    label: "Pending",
  },
  failed: { cls: "bg-red-500/10 text-red-700 border-red-500/20", icon: XCircle, label: "Failed" },
  refunded: {
    cls: "bg-muted text-muted-foreground border-border",
    icon: XCircle,
    label: "Refunded",
  },
};

const StatusBadge = ({ status }: { status: Payment["status"] | "refunded" }) => {
  const {
    cls,
    icon: Icon,
    label,
  } = paymentStatusVariants[status as keyof typeof paymentStatusVariants] ?? paymentStatusVariants.pending;
  return (
    <Badge variant="outline" className={cn("gap-1.5 border", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
};

const CopyBtn = ({ text }: { text: string }) => {
  const { copied, handleCopy } = useCopy();
  return (
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
  );
};

const DetailRow = ({ label, value, action, mono }: any) => (
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      <div className={cn("text-sm", mono && "font-mono break-all")}>{value}</div>
    </div>
    {action}
  </div>
);

// --- Table Config ---

const paymentColumns: ColumnDef<ResolvedPayment>[] = [
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="font-medium">{Money.formatFiat(row.original.amountCents ?? 0, row.original.currencyCode)}</span>
    ),
    meta: { filterable: true, filterVariant: "number" },
  },
  {
    accessorKey: "checkoutId",
    header: "Description",
    cell: ({ row }) => <span className="text-muted-foreground font-mono text-sm">{row.original.checkoutId}</span>,
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.refunded ? "refunded" : row.original.status} />,
    meta: {
      filterable: true,
      filterVariant: "select",
      filterOptions: [
        { label: "Refunded", value: true },
        { label: "Confirmed", value: false },
      ],
    },
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-xs">{moment(row.original.createdAt).format("MMM DD, YYYY")}</div>
    ),
    meta: { filterable: true, filterVariant: "date" },
  },
];

// --- Page Component ---

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id: customerId } = useParams() as { id: string };
  const [hiddenWallets, setHiddenWallets] = React.useState<Set<string>>(new Set());
  const checkoutModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [checkoutModalFooterProps, setCheckoutModalFooterProps] = React.useState({
    isPending: false,
    createdUrl: null as string | null,
  });
  const isCheckoutModalOpenRef = React.useRef(false);
  const refundModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [refundModalFooterProps, setRefundModalFooterProps] = React.useState({ isPending: false });
  const isRefundModalOpenRef = React.useRef(false);
  const invalidate = useInvalidateOrgQuery();
  const { data: orgContext } = useOrgContext();
  const { data: payments, isLoading: isLoadingPayments } = useOrgQuery(["payments", customerId], () =>
    retrievePayments(undefined, undefined, { customerId: customerId }, { withRefunds: true, withWallets: true }).then(
      (res) => res.data
    )
  );
  const { data: customer, isLoading: customerLoading } = useOrgQuery(["customer", customerId], () =>
    retrieveCustomers({ id: customerId }, { withWallets: true, requireLookUpParams: true }).then(({ data: [c] }) => c)
  );
  const { data: customerEvents, isLoading: isLoadingCustomerEvents } = useOrgQuery(
    ["customer-events", customerId],
    () => retrieveEvents({ customerId })
  );

  const openRefundModal = React.useCallback(
    (paymentToRefund: ResolvedPayment | null) => {
      isRefundModalOpenRef.current = true;
      setRefundModalFooterProps({ isPending: false });
      AppModal.open({
        title: "Create Refund",
        description: "Process a refund for a transaction by providing the payment details.",
        content: (
          <RefundModalContent
            payment={paymentToRefund}
            initialPaymentId={paymentToRefund?.id}
            onSuccess={() => AppModal.close()}
            setSubmitRef={refundModalSubmitRef}
            onFooterChange={(props) => setRefundModalFooterProps((prev) => ({ ...prev, ...props }))}
          />
        ),
        footer: <RefundModalFooter onClose={AppModal.close} submitRef={refundModalSubmitRef} isPending={false} />,
        size: "small",
        showCloseButton: true,
        onClose: () => {
          isRefundModalOpenRef.current = false;
        },
      });
    },
    [customerId, invalidate]
  );

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

  const openCheckoutModal = React.useCallback(() => {
    isCheckoutModalOpenRef.current = true;
    setCheckoutModalFooterProps({ isPending: false, createdUrl: null });
    AppModal.open({
      title: "Create Checkout",
      description: "Create a new checkout session for this customer.",
      content: (
        <CheckoutModalContent
          customerId={customerId}
          onClose={AppModal.close}
          setSubmitRef={checkoutModalSubmitRef}
          onFooterChange={(props) => setCheckoutModalFooterProps((prev) => ({ ...prev, ...props }))}
        />
      ),
      footer: (
        <CheckoutModalFooter
          onClose={AppModal.close}
          submitRef={checkoutModalSubmitRef}
          isPending={false}
          createdUrl={null}
          onDone={AppModal.close}
        />
      ),
      size: "small",
      showCloseButton: true,
      onClose: () => {
        isCheckoutModalOpenRef.current = false;
      },
    });
  }, [customerId]);

  React.useEffect(() => {
    if (!isCheckoutModalOpenRef.current) return;
    AppModal.updateConfig({
      footer: (
        <CheckoutModalFooter
          onClose={AppModal.close}
          submitRef={checkoutModalSubmitRef}
          isPending={checkoutModalFooterProps.isPending}
          createdUrl={checkoutModalFooterProps.createdUrl}
          onDone={AppModal.close}
        />
      ),
    });
  }, [checkoutModalFooterProps.isPending, checkoutModalFooterProps.createdUrl]);

  const openEditModal = React.useCallback(() => {
    if (!customer) return;
    AppModal.open({
      title: "Edit customer",
      description: "Update customer information",
      content: (
        <CustomerModalContent
          customer={customer}
          onClose={AppModal.close}
          onSuccess={() => {
            invalidate(["customer", customerId]);
            invalidate(["customer-events", customerId]);
            AppModal.close();
          }}
        />
      ),
      footer: null,
      size: "full",
      showCloseButton: true,
    });
  }, [customer, customerId, invalidate]);

  const openPortalLinkModal = React.useCallback(() => {
    AppModal.open({
      title: "Customer portal link",
      description: "Generate a link for this customer to access their portal.",
      content: <PortalLinkModalContent customerId={customerId} onClose={AppModal.close} />,
      footer: null,
      size: "small",
      showCloseButton: true,
    });
  }, [customerId]);

  const confirmedPayments = React.useMemo(
    () => payments?.filter((p) => p.status === "confirmed" && !p.refunded) ?? [],
    [payments]
  );

  const { convertAndFormat, fiatRates } = useCurrencyConverter();
  const [columnFilters, setColumnFilters] = useSyncTableFilters();

  // Convert each payment to USD cents first, then convertAndFormat handles org-currency display
  const totalSpentUsdCents = React.useMemo(
    () =>
      confirmedPayments.reduce((sum, p) => {
        const fromRate = fiatRates?.[p.currencyCode] ?? 1;
        return sum + (p.amountCents ?? 0) / fromRate;
      }, 0),
    [confirmedPayments, fiatRates]
  );

  if (customerLoading) return <CustomerDetailSkeleton />;

  if (!customer) return <NotFound router={router} />;

  const isNew = new Date().getTime() - customer.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;

  const imageUrl = customer.image ?? null;
  const initials =
    customer.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase() ?? "?";

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/customers">Customers</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{customer.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Avatar className="border-border h-12 w-12 rounded-full border sm:h-14 sm:w-14">
                {imageUrl ? (
                  <AvatarImage className="object-cover" src={imageUrl} alt={customer.name ?? "Customer avatar"} />
                ) : (
                  <AvatarFallback className="text-muted-foreground text-lg font-semibold">{initials}</AvatarFallback>
                )}
              </Avatar>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold sm:text-3xl">{customer.name}</h1>
                  {isNew && <Badge variant="secondary">New customer</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">{customer.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 shadow-none" onClick={openCheckoutModal}>
                <CreditCard className="h-4 w-4" /> <span>Checkout</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shadow-none">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openPortalLinkModal}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Generate portal link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openEditModal}>Edit customer</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Payments</h3>
                <DataTable
                  columnFilters={columnFilters}
                  setColumnFilters={setColumnFilters}
                  columns={paymentColumns}
                  data={payments ?? []}
                  isLoading={isLoadingPayments}
                  actions={(row) => {
                    const actions: Array<TableAction<ResolvedPayment>> = [
                      {
                        label: "Copy ID",
                        onClick: (p) => {
                          navigator.clipboard.writeText(p.id);
                          toast.success("Copied");
                        },
                      },
                      {
                        label: "View Details",
                        onClick: (p) => {
                          router.push(`/transactions/${p.id}`);
                        },
                      },
                    ];

                    if (!row.refunded) {
                      actions.push({
                        label: "Refund Payment",
                        onClick: async (p) => {
                          const paymentToRefund = payments?.find(({ id }) => p.id == id) ?? null;
                          if (!paymentToRefund) return;
                          openRefundModal(paymentToRefund);
                        },
                      });
                    }

                    return actions;
                  }}
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Activities</h3>

                <Timeline
                  limit={3}
                  isLoading={isLoadingCustomerEvents}
                  items={customerEvents ?? []}
                  renderItem={(evt) => ({
                    title: _.startCase(evt.type.replace(/[::$]/g, " ")),
                    date: moment(evt.createdAt).format("MMM DD, YYYY hh:mm A"),
                    data: evt.data,
                  })}
                  routeMap={TIMELINE_ROUTE_MAP}
                  linkComponent={Link}
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Wallet Addresses</h3>
                </div>
                <div className="space-y-3">
                  {customer.wallets?.map(({ address }) => (
                    <div key={address} className="bg-muted/50 flex items-center gap-3 rounded-lg border p-4">
                      <Stellar className="h-5 w-5" />

                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs break-all sm:text-sm">
                          {hiddenWallets.has(address) ? "•".repeat(20) : address}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            const next = new Set(hiddenWallets);
                            next.has(address) ? next.delete(address) : next.add(address);
                            setHiddenWallets(next);
                          }}
                        >
                          {hiddenWallets.has(address) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <CopyBtn text={address} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-8">
              <div>
                <h3 className="mb-2 text-lg font-semibold">Insights</h3>
                <p className="text-xl font-bold">{convertAndFormat(totalSpentUsdCents)}</p>
                <p className="text-muted-foreground text-xs">Total spent</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Details</h3>
                  <Button variant="ghost" size="icon-sm" onClick={openEditModal}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <DetailRow label="Customer ID" value={customer.id} mono action={<CopyBtn text={customer.id} />} />
                <Separator />
                <DetailRow label="Customer since" value={moment(customer.createdAt).format("MMM DD, YYYY")} />
                <Separator />
                <DetailRow label="Billing email" value={customer.email} action={<CopyBtn text={customer.email!} />} />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Metadata</h3>
                {customer.metadata ? (
                  <CodeBlock language="json">{JSON.stringify(customer.metadata, null, 2)}</CodeBlock>
                ) : (
                  <div className="text-muted-foreground rounded-lg border-2 border-dashed p-6 text-center text-xs">
                    No metadata
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}

// --- Checkout Modal ---

const checkoutSchema = z.object({
  productId: z.string().min(1, "Product required"),
  description: z.string().optional(),
  redirectUrl: z.url("Invalid URL").optional().or(z.literal("")),
});

function CheckoutModalFooter({
  onClose,
  submitRef,
  isPending,
  createdUrl,
  onDone,
}: {
  onClose: () => void;
  submitRef: React.MutableRefObject<(() => void) | null>;
  isPending: boolean;
  createdUrl: string | null;
  onDone: () => void;
}) {
  if (createdUrl) {
    return (
      <div className="flex w-full justify-end gap-2">
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }
  return (
    <div className="flex w-full justify-end gap-2">
      <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
        Cancel
      </Button>
      <Button onClick={() => submitRef.current?.()} disabled={isPending} isLoading={isPending}>
        Create Checkout
      </Button>
    </div>
  );
}

function CheckoutModalContent({
  customerId,
  onClose,
  setSubmitRef,
  onFooterChange,
}: {
  customerId: string;
  onClose: () => void;
  setSubmitRef?: React.MutableRefObject<(() => void) | null>;
  onFooterChange?: (props: { isPending: boolean; createdUrl: string | null }) => void;
}) {
  const { data: orgContext } = useOrgContext();
  const [createdUrl, setCreatedUrl] = React.useState<string | null>(null);
  const { copied, handleCopy } = useCopy();

  const form = RHF.useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      productId: "",
      description: "",
      redirectUrl: "",
    },
  });

  const handleClose = () => {
    onClose();
    setCreatedUrl(null);
    form.reset();
  };

  const { data: productsData, isLoading: isLoadingProducts } = useOrgQuery(["products"], () => retrieveProducts());

  const products = React.useMemo(() => {
    return (
      productsData
        ?.filter((p) => p.status === "active")
        .map((p) => {
          const price = new Intl.NumberFormat("en", {
            style: "currency",
            currency: p.currencyCode,
          }).format(p.priceCents / 100);

          return {
            value: p.id,
            label: `${p.name} - ${price}`,
            type: p.type,
            recurringPeriod: p.recurringPeriod,
          };
        }) ?? []
    );
  }, [productsData]);

  const { mutate: createCheckoutAction, isPending: isCreatingCheckout } = useAction(
    async (data: z.infer<typeof checkoutSchema>) => {
      if (!orgContext) throw new AppError("No organization context found");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token! },
      });
      const response = await api.post<Checkout>("/checkout?type=product", {
        customer_id: customerId,
        customer_email: undefined,
        customer_phone: undefined,
        product_id: data.productId,
        description: data.description,
        redirect_url: data.redirectUrl || undefined,
        metadata: null,
      });

      if (response.isErr()) {
        throw new AppError(response.error.message);
      }
      return response.value as Checkout;
    },
    {
      invalidate: [["payments"], ["customer-events", customerId]],
      successMsg: "Checkout created",
      errorMsg: "Failed to create checkout",
      onSuccess: (data: any) => {
        const baseUrl =
          (typeof process.env.NEXT_PUBLIC_CHECKOUT_URL === "string" && process.env.NEXT_PUBLIC_CHECKOUT_URL.trim()) ||
          (typeof window !== "undefined" ? window.location.origin : "");
        let checkoutID = data?.data?.id;
        const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/${checkoutID}` : checkoutID;
        setCreatedUrl(url);
      },
    }
  );

  const submitForm = React.useCallback(() => {
    form.handleSubmit((d) => createCheckoutAction(d))();
  }, [form, createCheckoutAction]);

  React.useEffect(() => {
    if (!setSubmitRef) return;
    setSubmitRef.current = submitForm;
    return () => {
      setSubmitRef.current = null;
    };
  }, [setSubmitRef, submitForm]);

  React.useEffect(() => {
    onFooterChange?.({ isPending: isCreatingCheckout, createdUrl });
  }, [isCreatingCheckout, createdUrl, onFooterChange]);

  const showInlineFooter = !setSubmitRef;

  return (
    <div className="flex flex-col gap-6">
      {showInlineFooter && (
        <div className="flex w-full justify-end gap-2 border-b pb-4">
          {createdUrl ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" type="button" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={submitForm} isLoading={isCreatingCheckout}>
                Create Checkout
              </Button>
            </>
          )}
        </div>
      )}
      {createdUrl ? (
        <div className="space-y-6 py-4">
          <div className="flex items-center gap-2">
            <div className="bg-muted border-border flex-1 rounded-md border px-3 py-1.5 shadow-none">
              <code className="text-muted-foreground font-mono text-sm break-all">{createdUrl}</code>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy({ text: createdUrl, message: "Copied" })}
              className="shrink-0 shadow-none"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4 py-4">
          <RHF.Controller
            control={form.control}
            name="productId"
            render={({ field, fieldState: { error } }) => (
              <SelectField
                id="productId"
                label="Product"
                items={products}
                value={field.value}
                onChange={field.onChange}
                isLoading={isLoadingProducts}
                error={error?.message}
              />
            )}
          />
          <RHF.Controller
            control={form.control}
            name="description"
            render={({ field, fieldState: { error } }) => (
              <TextAreaField
                id="description"
                label="Description"
                {...field}
                value={field.value || ""}
                error={error?.message}
              />
            )}
          />

          <RHF.Controller
            control={form.control}
            name="redirectUrl"
            render={({ field, fieldState: { error } }) => (
              <TextField
                id="redirectUrl"
                label="Redirect URL"
                placeholder="https://example.com/thank-you"
                {...field}
                value={field.value || ""}
                error={error?.message}
              />
            )}
          />
        </form>
      )}
    </div>
  );
}

function PortalLinkModalContent({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: orgContext } = useOrgContext();
  const [url, setUrl] = React.useState<string | null>(null);

  const { copied, handleCopy } = useCopy();

  const { mutate: generatePortalLinkAction, isPending: isGeneratingPortalLink } = useAction(
    async () => {
      if (!orgContext) throw new AppError("Organization context not found");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token! },
      });

      const response = await api.post<{ url: string; token: string; expiresAt: Date }>(
        `/customers/${customerId}/portal`
      );

      if (response.isErr()) {
        throw new AppError(response.error.message);
      }

      return response.value;
    },
    {
      invalidate: [["customer-portal", customerId]],
      successMsg: "Portal link generated",
      errorMsg: "Failed to generate portal link",
      onSuccess: (data) => {
        if (data?.url) setUrl(data?.url);
      },
    }
  );

  const handleClose = () => {
    onClose();
    setUrl(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {url ? (
        <div className="space-y-6 py-4">
          <p className="text-muted-foreground text-sm">Share this link with the customer.</p>
          <div className="flex items-center gap-2">
            <div className="bg-muted border-border flex-1 rounded-md border px-3 py-1.5 shadow-none">
              <code className="text-muted-foreground font-mono text-sm break-all">{url}</code>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy({ text: url, message: "Copied" })}
              className="shrink-0 shadow-none"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground py-2 text-sm">
          Generate a one-time link for this customer to view subscriptions and payments.
          {url}
        </p>
      )}

      <div className="flex w-full justify-end gap-2 pb-4">
        {url ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={generatePortalLinkAction} isLoading={isGeneratingPortalLink}>
              Generate link
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function NotFound({ router }: any) {
  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="py-24 text-center">
          <h1 className="text-xl font-bold">Customer not found</h1>
          <Button onClick={() => router.push("/customers")} className="mt-4">
            Back
          </Button>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}

function CustomerDetailSkeleton() {
  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>

          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-5 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="space-y-3">
                <Skeleton className="h-6 w-24" />
                <div className="space-y-2 rounded-lg border p-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-8 w-8" />
                </div>
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-muted/50 flex items-center gap-3 rounded-lg border p-4">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-8">
              <div className="space-y-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-8" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <Skeleton className="h-8 w-8" />
                    </div>
                    {i < 3 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            </aside>
          </div>
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}
