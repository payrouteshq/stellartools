"use client";

import * as React from "react";

import { retrieveCustomers } from "@/actions/customers";
import { retrieveProducts } from "@/actions/product";
import { DateField } from "@/components/date-field";
import { NumberField } from "@/components/number-field";
import { ResourceField } from "@/components/resource-field";
import { TextField } from "@/components/text-field";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { STROOPS_PER_XLM, stroopsToXlm } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import moment from "moment";
import * as RHF from "react-hook-form";
import { z } from "zod";

export const formatXLM = (s: number) => (s / STROOPS_PER_XLM).toLocaleString(undefined, { minimumFractionDigits: 2 });

const subscriptionFormSchema = z.object({
  customerIds: z.array(z.string()).min(1, "Select at least one customer"),
  productId: z.string().min(1, "Select a product"),
  billStarting: z.date(),
  trialDays: z.coerce.number().min(0).default(0),
  cancelAtPeriodEnd: z.boolean().default(false),
  metadata: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .default([]),
});

type SubscriptionFormData = z.infer<typeof subscriptionFormSchema>;

// --- Modal Content ---

export function SubscriptionModalContent({ onSuccess, editingSubscription, setSubmitRef, onFooterChange }: any) {
  const { data: org } = useOrgContext();

  const isEditMode = !!editingSubscription;
  const form = RHF.useForm({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: {
      customerIds: editingSubscription ? [editingSubscription.customerId] : [],
      productId: editingSubscription?.productId ?? "",
      billStarting: editingSubscription ? new Date(editingSubscription.currentPeriodStart) : new Date(),
      trialDays: editingSubscription?.trialDays ?? 0,
      cancelAtPeriodEnd: editingSubscription?.cancelAtPeriodEnd ?? false,
      metadata: editingSubscription?.metadata
        ? Object.entries(editingSubscription.metadata).map(([key, value]) => ({ key, value: String(value) }))
        : [],
    },
  });

  const { fields, append, remove } = RHF.useFieldArray({ control: form.control, name: "metadata" });
  const { data: customers, isLoading: loadingCust } = useOrgQuery(["customers"], retrieveCustomers);
  const { data: products = [], isLoading: loadingProd } = useOrgQuery(["products"], () =>
    retrieveProducts(undefined, undefined, { status: "active" })
  );

  // Derived Selection State
  const selectedProd = products.find((p) => p.product.id === form.watch("productId"));
  const price = selectedProd?.product.priceAmount ?? editingSubscription?.productPrice ?? 0;
  const billingStart = form.watch("billStarting");

  const mutation = useMutation({
    mutationFn: async (data: SubscriptionFormData) => {
      if (!org) throw new AppError("No organization context found");

      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
        headers: { "x-session-token": org?.token! },
      });

      const metadata = data.metadata.reduce(
        (acc, m) => {
          if (m.key) acc[m.key] = m.value;
          return acc;
        },
        {} as Record<string, string>
      );

      const payload = { ...data, metadata: Object.keys(metadata).length ? metadata : null };

      const res = isEditMode
        ? await api.put(`/api/subscriptions/${editingSubscription.id}`, payload)
        : await api.post("/api/subscriptions", payload);

      if (res.isErr()) throw new AppError(res.error.message);
      return res.value;
    },
    onSuccess: () => {
      toast.success(`Subscription ${isEditMode ? "updated" : "created"}`);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  React.useEffect(() => {
    if (setSubmitRef) setSubmitRef.current = form.handleSubmit((d) => mutation.mutate(d));
  }, [form, mutation, setSubmitRef]);

  React.useEffect(() => {
    onFooterChange?.({ isPending: mutation.isPending });
  }, [mutation.isPending, onFooterChange]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-7">
      <div className="space-y-8 lg:col-span-4">
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Customer</h3>
          <RHF.Controller
            name="customerIds"
            control={form.control}
            render={({ field }) => (
              <ResourceField
                isLoading={loadingCust}
                items={customers?.data ?? []}
                value={field.value}
                onChange={field.onChange}
                multiple
                placeholder="Find or add a customer..."
                renderItem={(c) => ({ searchValue: c.name!, id: c.id, title: c.name!, subtitle: c.email! })}
              />
            )}
          />
        </section>

        <Separator />

        <section className="space-y-6">
          <h3 className="text-base font-semibold">Subscription details</h3>

          <div className="space-y-4 rounded-lg border p-5">
            <h4 className="text-sm font-semibold">Pricing</h4>
            <RHF.Controller
              name="productId"
              control={form.control}
              render={({ field }) => (
                <ResourceField
                  isLoading={loadingProd}
                  items={products.filter((p) => p.product.type === "subscription")}
                  value={field.value ? [field.value] : []}
                  onChange={field.onChange}
                  renderItem={(p) => ({
                    searchValue: p.product.name!,
                    id: p.product.id,
                    title: p.product.name,
                    subtitle: `${formatXLM(Number(stroopsToXlm(BigInt(p.product.priceAmount.toString()))))} XLM / ${p.product.recurringPeriod}`,
                  })}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <RHF.Controller
              name="billStarting"
              control={form.control}
              render={({ field }) => (
                <DateField
                  id="billStarting"
                  label="Bill starting"
                  value={field.value}
                  onChange={field.onChange}
                  helpText="When the first invoice generates."
                />
              )}
            />
            <RHF.Controller
              name="trialDays"
              control={form.control}
              render={({ field }) => (
                <NumberField
                  id="trialDays"
                  label="Free trial days"
                  value={field.value as number}
                  onChange={field.onChange}
                  placeholder="0"
                />
              )}
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Metadata</h4>
            {fields.map((field, i) => (
              <div key={field.id} className="animate-in slide-in-from-top-1 flex items-end gap-2">
                <RHF.Controller
                  name={`metadata.${i}.key`}
                  control={form.control}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      id={`meta-k-${i}`}
                      label={i === 0 ? "Key" : null}
                      value={field.value as string}
                      onChange={field.onChange}
                      placeholder="e.g. internal_id"
                      className="flex-1 shadow-none"
                      error={error?.message}
                    />
                  )}
                />

                <RHF.Controller
                  name={`metadata.${i}.value`}
                  control={form.control}
                  render={({ field, fieldState: { error } }) => (
                    <TextField
                      id={`meta-v-${i}`}
                      label={i === 0 ? "Value" : null}
                      value={field.value as string}
                      onChange={field.onChange}
                      placeholder="value"
                      className="flex-1 shadow-none"
                      error={error?.message}
                    />
                  )}
                />

                <Button variant="ghost" size="icon" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ key: "", value: "" })}
              className="text-primary text-sm font-medium hover:underline"
            >
              + Add metadata
            </button>
          </div>

          <div className="flex items-start gap-3">
            <RHF.Controller
              name="cancelAtPeriodEnd"
              control={form.control}
              render={({ field }) => (
                <Checkbox id="cancelAtPeriodEnd" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <div className="grid gap-1">
              <Label htmlFor="cancelAtPeriodEnd" className="font-bold">
                Cancel at period end
              </Label>
              <p className="text-muted-foreground text-xs">
                Automatically end the subscription after the current cycle.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="lg:col-span-3">
        <Card className="bg-muted/30 sticky top-6 shadow-none">
          <CardContent className="space-y-6 p-6">
            <h3 className="text-lg font-semibold">Preview</h3>
            <Tabs defaultValue="summary">
              <TabsList className="w-full">
                <TabsTrigger value="summary" className="flex-1">
                  Summary
                </TabsTrigger>
                <TabsTrigger value="invoice" className="flex-1">
                  Invoice
                </TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="pt-4">
                <Timeline
                  items={[
                    { title: "Subscription starts", date: moment(billingStart).format("D MMM, YYYY") },
                    {
                      title: "First invoice generated",
                      date: moment(billingStart)
                        .add(form.watch("trialDays") as number, "days")
                        .format("D MMM, YYYY"),
                    },
                  ]}
                  renderItem={(item) => ({ title: item.title, date: item.date, data: {} })}
                />
              </TabsContent>
              <TabsContent value="invoice" className="space-y-4 pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatXLM(price)} XLM</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total due now</span>
                    <span className="text-primary">
                      {formatXLM((form.watch("trialDays") as number) > 0 ? 0 : price)} XLM
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
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
