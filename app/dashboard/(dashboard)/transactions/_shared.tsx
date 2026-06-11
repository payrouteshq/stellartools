"use client";

import * as React from "react";

import { retrieveCustomerWallets } from "@/actions/customers";
import { SelectField } from "@/components/select-field";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { ResolvedPayment } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useInvalidateOrgQuery, useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { truncate } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import * as RHF from "react-hook-form";
import { z } from "zod";

export interface TransactionEsquee extends Pick<
  ResolvedPayment,
  "id" | "amountCents" | "currencyCode" | "status" | "createdAt" | "customer"
> {
  walletAddress?: string;
  refundedDate?: Date;
  description: string;
}

// --- Refund Modal Schema ---

const refundSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  walletAddress: z.string().min(1, "Wallet address is required"),
  reason: z.string().optional(),
});

type RefundFormData = z.infer<typeof refundSchema>;

export function RefundModalContent({
  initialPaymentId,
  onClose,
  onSuccess,
  setSubmitRef,
  onFooterChange,
  payment,
}: {
  initialPaymentId?: string;
  onClose: () => void;
  onSuccess: () => void;
  setSubmitRef?: React.MutableRefObject<(() => void) | null>;
  onFooterChange?: (props: { isPending: boolean }) => void;
  payment: ResolvedPayment | null;
}) {
  const { data: orgContext } = useOrgContext();
  const invalidate = useInvalidateOrgQuery();
  const form = RHF.useForm<RefundFormData>({
    resolver: zodResolver(refundSchema),
    defaultValues: {
      paymentId: initialPaymentId ?? "",
      walletAddress: "",
      reason: "",
    },
  });

  const { data: customerWalletsList = [], isLoading: isLoadingWallets } = useOrgQuery(
    ["customer-wallets", payment?.customerId],
    async () => retrieveCustomerWallets(payment!.customerId!),
    { enabled: !!payment?.customerId }
  );

  React.useEffect(() => {
    if (initialPaymentId) form.setValue("paymentId", initialPaymentId);
    if (payment?.wallets?.address) form.setValue("walletAddress", payment?.wallets?.address);
  }, [initialPaymentId, form, payment]);

  const { mutate: createRefund, isPending: isCreatingRefund } = useAction(
    async (data: RefundFormData) => {
      if (!orgContext) throw new AppError("No organization context found");
      if (!data.walletAddress?.trim()) throw new AppError("Wallet address is required");
      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext?.token! },
      });
      const result = await api.post<{ id: string }>("/refunds", {
        payment_id: data.paymentId,
        metadata: null,
        wallet_address: data.walletAddress,
        reason: data.reason ?? null,
      });
      if (result.isErr()) throw new AppError(result.error.message);
      return result.value;
    },
    {
      onSuccess: () => form.reset(),
      invalidate: ["payments"],
      successMsg: "Refund successful",
      errorMsg: "Failed to create refund",
    }
  );

  const submitForm = React.useCallback(() => {
    form.handleSubmit((data) => createRefund(data))();
  }, [form, createRefund]);

  React.useEffect(() => {
    if (!setSubmitRef) return;
    setSubmitRef.current = submitForm;
    return () => {
      setSubmitRef.current = null;
    };
  }, [setSubmitRef, submitForm]);

  React.useEffect(() => {
    onFooterChange?.({ isPending: isCreatingRefund });
  }, [isCreatingRefund, onFooterChange]);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-6">
        <RHF.Controller
          control={form.control}
          name="walletAddress"
          render={({ field, fieldState: { error } }) => {
            if (customerWalletsList.length == 0 && !payment?.wallets?.address) {
              return (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  id="walletAddress"
                  label="Wallet Address"
                  error={error?.message}
                  placeholder="Enter wallet address"
                  className="shadow-none"
                />
              );
            }

            return (
              <SelectField
                id="walletAddress"
                label="Refund to wallet"
                value={field.value ?? ""}
                onChange={field.onChange}
                items={customerWalletsList.map((w: { id: string; address: string }) => ({
                  value: w.address,
                  label: truncate(w.address, { start: 10, end: 10 }),
                }))}
                placeholder="Select wallet"
                error={error?.message}
                isLoading={isLoadingWallets}
              />
            );
          }}
        />

        <RHF.Controller
          control={form.control}
          name="reason"
          render={({ field, fieldState: { error } }) => (
            <TextAreaField
              {...field}
              value={field.value ?? ""}
              id="reason"
              label="Reason"
              error={error?.message}
              placeholder="Enter reason for refund (optional)"
              className="min-h-[120px] shadow-none"
            />
          )}
        />
      </div>
    </div>
  );
}

// --- Refund Modal Footer ---

export function RefundModalFooter({
  onClose,
  submitRef,
  isPending,
}: {
  onClose: () => void;
  submitRef: React.MutableRefObject<(() => void) | null>;
  isPending: boolean;
}) {
  return (
    <div className="flex w-full justify-end gap-2">
      <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
        Cancel
      </Button>
      <Button onClick={() => submitRef.current?.()} disabled={isPending} isLoading={isPending}>
        Create refund
      </Button>
    </div>
  );
}
