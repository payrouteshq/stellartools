"use client";

import * as React from "react";

import { retrieveCustomers } from "@/actions/customers";
import { retrieveProducts } from "@/actions/product";
import { DateField } from "@/components/date-field";
import { ResourceField } from "@/components/resource-field";
import { Spinner } from "@/components/spinner";
import { TextField } from "@/components/text-field";
import { Timeline } from "@/components/timeline";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResolvedCustomer } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { STROOPS_PER_XLM, stroopsToXlm, truncate } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import { Trash2 } from "lucide-react";
import moment from "moment";
import * as RHF from "react-hook-form";
import { z } from "zod";

export const formatXLM = (s: number) => (s / STROOPS_PER_XLM).toLocaleString(undefined, { minimumFractionDigits: 2 });

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
  const selectedProduct = products.find((p) => p.product.id === watch.productId);
  const ready = !!selectedCustomer && !!selectedProduct;

  const timelineItems = React.useMemo(() => {
    if (!ready) return [];

    const amount = formatXLM(Number(stroopsToXlm(BigInt(selectedProduct.product.priceAmount))));
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
        baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
        headers: { "x-session-token": org.token! },
      });
      const metadata = Object.fromEntries(data.metadata.filter((m) => m.key).map((m) => [m.key, m.value]));

      const payload = {
        customerIds: [data.customerId],
        productId: data.productId,
        billStarting: trialEnabled ? data.trialEndDate : new Date(),
        trialDays: trialEnabled ? moment(data.trialEndDate).diff(moment(), "days") + 1 : 0,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        metadata: Object.keys(metadata).length ? metadata : null,
      };

      const res = isEditMode
        ? await api.put(`/api/subscriptions/${editingSubscription.id}`, payload)
        : await api.post("/api/subscriptions", payload);

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
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Items</h3>
          <RHF.Controller
            name="productId"
            control={form.control}
            render={({ field, fieldState: { error } }) => (
              <ResourceField
                isLoading={isLoadingProducts}
                items={products.filter((p) => p.product.type === "subscription")}
                value={selectedProduct || null}
                onChange={(p) => field.onChange(p?.product.id ?? "")}
                getItemTitle={(p) => p.product.name}
                searchFilter={(p, q) => p.product.name.toLowerCase().includes(q.toLowerCase())}
                error={error?.message}
                renderSearchItem={(p) => (
                  <div className="p-2.5">
                    <p className="text-[13px] font-semibold">{p.product.name}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {formatXLM(Number(stroopsToXlm(BigInt(p.product.priceAmount))))} XLM / {p.product.recurringPeriod}
                    </p>
                  </div>
                )}
                renderSummary={(p) => (
                  <div>
                    <p className="text-sm font-semibold">{p.product.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatXLM(Number(stroopsToXlm(BigInt(p.product.priceAmount))))} XLM / {p.product.recurringPeriod}
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
                        <p className="text-[13px]">
                          {formatXLM(Number(stroopsToXlm(BigInt(p.product.priceAmount))))} XLM
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                          Billing
                        </Label>
                        <p className="text-[13px] capitalize">{p.product.recurringPeriod}</p>
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
            />
          ) : (
            <p className="text-muted-foreground text-sm">Add a customer and items to build the timeline.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SubscriptionModalFooter({ onClose, submitRef, isPending }: any) {
  return (
    <div className="flex w-full justify-end gap-3">
      <Button variant="outline" onClick={onClose} disabled={isPending}>
        Cancel
      </Button>
      <Button onClick={() => submitRef.current?.()} isLoading={isPending}>
        Save Subscription
      </Button>
    </div>
  );
}
