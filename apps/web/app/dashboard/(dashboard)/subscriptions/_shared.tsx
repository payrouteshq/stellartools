"use client";

import * as React from "react";

import { retrieveCustomers } from "@/actions/customers";
import { retrieveProducts } from "@/actions/product";
import { TIMELINE_ROUTE_MAP } from "@/constant";
import { ResolvedCustomer } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { truncate } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AppModal,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Checkbox,
  DateField,
  Label,
  RadioGroup,
  RadioGroupItem,
  ResourceField,
  Spinner,
  TextField,
  Timeline,
  cn,
} from "@stellartools/shared-ui";
import { Trash2 } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import * as RHF from "react-hook-form";
import { z } from "zod";

export type SubscriptionRowEsquee = {
  id: string;
  customer: string;
  customerEmail: string | null | undefined;
  status: string;
  cancelAtPeriodEnd: boolean;
  product: string | null | undefined;
  amount: number | null | undefined;
  currencyCode: string;
  period: string | null | undefined;
  customDurationMs: number | null | undefined;
  currentPeriodEnd: Date;
  createdAt: Date;
};

export const formatPeriod = (
  recurringPeriod: string | null | undefined,
  customDurationMs: number | null | undefined
): string => {
  if (!recurringPeriod) return "";
  if (recurringPeriod === "custom" && customDurationMs) {
    const MS_MONTH = 2592000000,
      MS_WEEK = 604800000,
      MS_DAY = 86400000;
    const qty =
      customDurationMs % MS_MONTH === 0
        ? customDurationMs / MS_MONTH
        : customDurationMs % MS_WEEK === 0
          ? customDurationMs / MS_WEEK
          : Math.round(customDurationMs / MS_DAY);
    const unit = customDurationMs % MS_MONTH === 0 ? "month" : customDurationMs % MS_WEEK === 0 ? "week" : "day";
    return `every ${qty} ${unit}${qty !== 1 ? "s" : ""}`;
  }
  return recurringPeriod;
};

const SUBSCRIPTION_STATUS_MAP: Record<string, { cls: string; label: string }> = {
  active: { cls: "bg-green-500/10 text-green-700 border-green-500/20", label: "Active" },
  trialing: { cls: "bg-blue-500/10 text-blue-700 border-blue-500/20", label: "Trialing" },
  past_due: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Past due" },
  canceled: { cls: "bg-muted text-muted-foreground border-border", label: "Canceled" },
  paused: { cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", label: "Paused" },
};

export const SubscriptionStatusBadge = ({
  status,
  cancelAtPeriodEnd,
  currentPeriodEnd,
  canceledAt,
}: {
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  canceledAt?: Date | string | null;
}) => {
  if (cancelAtPeriodEnd && status !== "canceled" && currentPeriodEnd) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-destructive/20 bg-destructive/10 text-destructive"
      >
        Cancels on {moment(currentPeriodEnd).format("MMM D, YYYY")}
      </Badge>
    );
  }

  if (status === "canceled" && canceledAt) {
    return (
      <Badge variant="outline" className="gap-1.5 border-border bg-muted text-muted-foreground">
        Canceled on {moment(canceledAt).format("MMM D, YYYY")}
      </Badge>
    );
  }

  const cfg = SUBSCRIPTION_STATUS_MAP[status] ?? SUBSCRIPTION_STATUS_MAP.active;
  return (
    <Badge variant="outline" className={cn("gap-1.5", cfg.cls)}>
      {cfg.label}
    </Badge>
  );
};

export function confirmAction(
  opts: { title: string; description: string; confirmLabel: string; destructive?: boolean },
  onConfirm: () => void,
  isPending: boolean
) {
  AppModal.open({
    title: opts.title,
    description: opts.description,
    size: "small",
    showCloseButton: true,
    content: null,
    primaryButton: {
      children: opts.confirmLabel,
      variant: opts.destructive ? "destructive" : "default",
      onClick: () => {
        onConfirm();
      },
      disabled: isPending,
    },
    secondaryButton: { children: "Cancel" },
  });
}

export function openCreateSubscriptionInfoModal(options?: {
  onPrimaryClick?: () => void;
  primaryLabel?: string;
}) {
  AppModal.open({
    title: "Create subscription",
    description: "Subscriptions are created through checkout.",
    size: "small",
    showCloseButton: true,
    content: (
      <div className="text-muted-foreground space-y-3 text-sm">
        <p>To start a subscription:</p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>Create a recurring product in Products.</li>
          <li>Open a customer and create a checkout for that product.</li>
        </ol>
        <p>The subscription is created automatically when the customer pays.</p>
      </div>
    ),
    primaryButton: {
      children: options?.primaryLabel ?? "Go to products",
      onClick: () => {
        AppModal.close();
        options?.onPrimaryClick?.();
      },
    },
    secondaryButton: { children: "Close" },
  });
}

const subscriptionFormSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  productId: z.string().min(1, "Select an item"),
  trialEndDate: z.date().optional(),
  onTrialEnd: z.enum(["cancel", "pause"]).default("cancel"),
  cancelAtPeriodEnd: z.boolean().default(false),
  metadata: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
});

function CustomerDetail({
  c,
  close,
  remove,
  picker,
}: {
  c: ResolvedCustomer;
  close: () => void;
  remove: () => void;
  picker: React.ReactNode;
}) {
  const { data: customer, isPending } = useOrgQuery(["customer", c.id], () =>
    retrieveCustomers({ id: c.id }, { withWallets: true, requireLookUpParams: true }).then(({ data: [r] }) => r)
  );

  const wallets = customer?.wallets?.map((w) => w.address) ?? [];

  return (
    <div className="space-y-4 pt-2">
      {picker}
      {isPending ? (
        <Spinner size={25} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            {c.image ? (
              <img src={c.image} className="size-10 rounded-full object-cover" alt="" />
            ) : (
              <div className="bg-muted flex size-10 items-center justify-center rounded-full font-bold">
                {(c.name || c.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-muted-foreground text-xs">{c.email}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {c.email && (
              <div className="flex flex-col">
                <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">Email</Label>
                <p className="text-[13px]">{c.email}</p>
              </div>
            )}
            {c.phone && (
              <div className="flex flex-col">
                <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">Phone</Label>
                <p className="text-[13px]">{c.phone}</p>
              </div>
            )}
            {wallets.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Wallet{wallets.length > 1 ? "s" : ""}
                </Label>
                {wallets.map((addr) => (
                  <p key={addr} className="text-muted-foreground truncate font-mono text-[11px]">
                    {truncate(addr, { start: 6, end: 6 })}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-between border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              className="text-destructive hover:bg-destructive/10"
            >
              Remove
            </Button>
            <Button type="button" size="sm" onClick={close}>
              Confirm
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function SubscriptionModalContent({ onSuccess, editingSubscription, setSubmitRef, onFooterChange }: any) {
  const { data: org } = useOrgContext();
  const isEditMode = !!editingSubscription;

  const form = RHF.useForm({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      customerId: editingSubscription?.customerId ?? "",
      productId: editingSubscription?.productId ?? "",
      trialEndDate: moment().add(7, "days").toDate(),
      onTrialEnd: "cancel" as const,
      cancelAtPeriodEnd: editingSubscription?.cancelAtPeriodEnd ?? false,
      metadata: editingSubscription?.metadata
        ? Object.entries(editingSubscription.metadata).map(([key, value]) => ({ key, value: String(value) }))
        : [],
    },
  });

  const { fields, append, remove } = RHF.useFieldArray({ control: form.control, name: "metadata" });
  const [trialEnabled, setTrialEnabled] = React.useState(
    isEditMode ? (editingSubscription?.trialDays ?? 0) > 0 : false
  );

  const { data: customers, isPending: isLoadingCustomers } = useOrgQuery(["customers"], retrieveCustomers);
  const { data: products = [], isPending: isLoadingProducts } = useOrgQuery(["products"], () =>
    retrieveProducts(undefined, undefined, { status: "active" })
  );

  const watch = form.watch();
  const selectedCustomer = (customers?.data ?? []).find((c) => c.id === watch.customerId);
  const selectedProduct = products.find((p) => p.id === watch.productId);
  const ready = !!selectedCustomer && !!selectedProduct;

  const timelineItems = React.useMemo(() => {
    if (!ready) return [];

    const amount = selectedProduct.priceCents;
    const chargeMsg = `${selectedCustomer.name || selectedCustomer.email} will be charged ${amount} XLM`;

    const start = { date: moment().format("MMM D, YYYY"), events: ["Subscription starts"] };
    const items = [start];

    if (trialEnabled && watch.trialEndDate) {
      start.events.push("Free trial starts");
      const endLabel = moment(watch.trialEndDate).format("MMM D");
      items.push({ date: endLabel, events: ["Free trial ends"] });
      items.push({ date: endLabel, events: ["Billing starts", chargeMsg] });
    } else {
      start.events.push(chargeMsg);
    }

    return items;
  }, [ready, trialEnabled, watch.trialEndDate, selectedCustomer, selectedProduct]);

  const { mutate: handleAction, isPending } = useAction(
    async (data: z.infer<typeof subscriptionFormSchema>) => {
      if (!org) throw new AppError("No organization context");

      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": org.token! },
      });
      const metadata = Object.fromEntries(data.metadata.filter((m) => m.key).map((m) => [m.key, m.value]));

      const payload = {
        customer_id: data.customerId,
        product_id: data.productId,
        trial_days: trialEnabled ? moment(data.trialEndDate).diff(moment(), "days") + 1 : 0,
        cancel_at_period_end: data.cancelAtPeriodEnd,
        metadata: Object.keys(metadata).length ? metadata : null,
      };

      const res = isEditMode
        ? await api.put(`/subscriptions/${editingSubscription.id}`, {
            ...(Object.keys(metadata).length ? { metadata } : {}),
            ...(data.cancelAtPeriodEnd && { cancel_at_period_end: data.cancelAtPeriodEnd }),
          })
        : await api.post("/subscriptions", payload);

      if (res.isErr()) throw new AppError(res.error.message);
      return res.value;
    },
    { invalidate: ["subscriptions"], successMsg: `Subscription ${isEditMode ? "updated" : "created"}`, onSuccess }
  );

  React.useEffect(() => {
    setSubmitRef.current = form.handleSubmit((d) => handleAction(d as any));
  }, [form, handleAction]);

  React.useEffect(() => {
    onFooterChange?.({ isPending });
  }, [isPending]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-7">
      <div className="space-y-6 lg:col-span-4">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Customer</h3>
          {isEditMode ? (
            <div className="bg-muted/40 border-border flex items-center gap-3 rounded-lg border px-4 py-3 opacity-70">
              <Avatar>
                <AvatarImage className="object-cover" src={selectedCustomer?.image ?? undefined} />
                <AvatarFallback>
                  {((editingSubscription?.customerName || editingSubscription?.customerEmail) ?? "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{editingSubscription?.customerName ?? selectedCustomer?.name}</p>
                <p className="text-muted-foreground text-xs">
                  {editingSubscription?.customerEmail ?? selectedCustomer?.email}
                </p>
              </div>
            </div>
          ) : (
            <RHF.Controller
              name="customerId"
              control={form.control}
              render={({ field, fieldState: { error } }) => (
                <ResourceField
                  isLoading={isLoadingCustomers}
                  items={customers?.data ?? []}
                  value={selectedCustomer || null}
                  onChange={(c) => field.onChange(c?.id ?? "")}
                  getItemTitle={(c) => c.name || c.email || ""}
                  searchFilter={(c, q) =>
                    (c.name?.toLowerCase().includes(q.toLowerCase()) ||
                      c.email?.toLowerCase().includes(q.toLowerCase())) ??
                    false
                  }
                  error={error?.message}
                  renderSearchItem={(c) => (
                    <div className="min-w-0 flex-1 p-2.5">
                      <p className="truncate text-[13px] font-semibold">{c.name}</p>
                      <p className="text-muted-foreground truncate text-[11px]">{c.email}</p>
                    </div>
                  )}
                  renderSummary={(c) => (
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage className="object-cover" src={c.image ?? undefined} />
                        <AvatarFallback>{(c.name || c.email || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-muted-foreground text-xs">{c.email}</p>
                      </div>
                    </div>
                  )}
                  renderDetail={(c, h) => <CustomerDetail c={c} {...h} />}
                />
              )}
            />
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Items</h3>
          {isEditMode ? (
            <div className="bg-muted/40 border-border rounded-lg border px-4 py-3 opacity-70">
              <p className="text-sm font-semibold">{editingSubscription?.productName ?? selectedProduct?.name}</p>
              {selectedProduct && (
                <p className="text-muted-foreground text-xs">
                  {Money.formatFiat(selectedProduct.priceCents, selectedProduct.currencyCode ?? "USD")} /{" "}
                  {formatPeriod(selectedProduct.recurringPeriod, selectedProduct.customDurationMs)}
                </p>
              )}
            </div>
          ) : (
            <RHF.Controller
              name="productId"
              control={form.control}
              render={({ field, fieldState: { error } }) => (
                <ResourceField
                  isLoading={isLoadingProducts}
                  items={products.filter((p) => p.type === "subscription")}
                  value={selectedProduct || null}
                  onChange={(p) => field.onChange(p?.id ?? "")}
                  getItemTitle={(p) => p.name}
                  searchFilter={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())}
                  error={error?.message}
                  renderSearchItem={(p) => (
                    <div className="p-2.5">
                      <p className="text-[13px] font-semibold">{p.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {Money.formatFiat(p.priceCents, p.currencyCode ?? "USD")} /{" "}
                        {formatPeriod(p.recurringPeriod, p.customDurationMs)}
                      </p>
                    </div>
                  )}
                  renderSummary={(p) => (
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {Money.formatFiat(p.priceCents, p.currencyCode ?? "USD")} /{" "}
                        {formatPeriod(p.recurringPeriod, p.customDurationMs)}
                      </p>
                    </div>
                  )}
                  renderDetail={(p, h) => (
                    <div className="space-y-4 pt-2">
                      {h.picker}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                            Price
                          </Label>
                          <p className="text-[13px]">{Money.formatFiat(p.priceCents, p.currencyCode ?? "USD")}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                            Billing
                          </Label>
                          <p className="text-[13px] capitalize">
                            {formatPeriod(p.recurringPeriod, p.customDurationMs)}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t pt-3">
                        <Button type="button" variant="ghost" size="sm" onClick={h.remove} className="text-destructive">
                          Remove
                        </Button>
                        <Button type="button" size="sm" onClick={h.close}>
                          Confirm
                        </Button>
                      </div>
                    </div>
                  )}
                />
              )}
            />
          )}
        </section>

        <Accordion type="multiple" defaultValue={["options"]}>
          <AccordionItem value="options" className="border-none">
            <AccordionTrigger className="py-1 text-sm font-semibold hover:no-underline">
              Subscription options
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pt-2">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="meta"
                  checked={fields.length > 0}
                  onCheckedChange={(v) => (v ? append({ key: "", value: "" }) : form.setValue("metadata", []))}
                />
                <div className="space-y-1">
                  <Label htmlFor="meta">Metadata</Label>
                  <p className="text-muted-foreground text-sm">Store additional information.</p>
                </div>
              </div>
              {fields.length > 0 && (
                <div className="space-y-2 pl-6">
                  {fields.map((f, i) => (
                    <div key={f.id} className="flex items-end gap-2">
                      <RHF.Controller
                        control={form.control}
                        name={`metadata.${i}.key`}
                        render={({ field: fieldProps, fieldState: { error } }) => (
                          <TextField
                            error={error?.message || null}
                            id={`metadata-key-${i}`}
                            value={fieldProps.value || ""}
                            onChange={fieldProps.onChange}
                            label={i === 0 ? "Key" : null}
                            placeholder="key"
                            className="flex-1"
                          />
                        )}
                      />
                      <RHF.Controller
                        control={form.control}
                        name={`metadata.${i}.value`}
                        render={({ field: fieldProps, fieldState: { error } }) => (
                          <TextField
                            error={error?.message || null}
                            id={`metadata-value-${i}`}
                            value={fieldProps.value || ""}
                            onChange={fieldProps.onChange}
                            label={i === 0 ? "Value" : null}
                            placeholder="value"
                            className="flex-1"
                          />
                        )}
                      />
                      <Button variant="ghost" size="icon" onClick={() => remove(i)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => append({ key: "", value: "" })}
                    className="text-primary text-sm font-medium"
                  >
                    + Add metadata
                  </button>
                </div>
              )}

              {!isEditMode && (
                <>
                  <div className="flex items-start gap-2.5">
                    <Checkbox id="trial" checked={trialEnabled} onCheckedChange={(v) => setTrialEnabled(!!v)} />
                    <div className="space-y-1">
                      <Label htmlFor="trial">Trial period</Label>
                      <p className="text-muted-foreground text-sm">Free access period.</p>
                    </div>
                  </div>

                  {trialEnabled && (
                    <div className="space-y-4 pl-6">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">{moment().format("MMM D")}</span>
                        <span className="text-muted-foreground">→</span>
                        <RHF.Controller
                          name="trialEndDate"
                          control={form.control}
                          render={({ field }) => (
                            <DateField
                              id={field.name}
                              value={field.value}
                              onChange={field.onChange}
                              calendarDisabled={{ before: new Date() }}
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">When trial ends without a payment method...</p>
                <RHF.Controller
                  name="onTrialEnd"
                  control={form.control}
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="cancel" id="trial-cancel" />
                        <Label htmlFor="trial-cancel" className="cursor-pointer font-normal">
                          Cancel subscription
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="pause" id="trial-pause" />
                        <Label htmlFor="trial-pause" className="cursor-pointer font-normal">
                          Pause subscription
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="lg:col-span-3">
        <div className="sticky top-6">
          {ready ? (
            <Timeline
              items={timelineItems}
              renderItem={(item) => ({
                title: item.date,
                date: "",
                data: {},
                contentOverride: (
                  <div className="space-y-0.5">
                    {item.events.map((e, i) => (
                      <p key={i} className="text-muted-foreground text-sm">
                        {e}
                      </p>
                    ))}
                  </div>
                ),
              })}
              routeMap={TIMELINE_ROUTE_MAP}
              linkComponent={Link}
            />
          ) : (
            <p className="text-muted-foreground text-sm">Add a customer and items to build the timeline.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SubscriptionModalFooter({ onClose, submitRef, isPending, isEditMode }: any) {
  return (
    <div className="flex w-full justify-end gap-3">
      <Button variant="outline" onClick={onClose} disabled={isPending}>
        Cancel
      </Button>
      <Button onClick={() => submitRef.current?.()} isLoading={isPending}>
        {isEditMode ? "Save changes" : "Save subscription"}
      </Button>
    </div>
  );
}
