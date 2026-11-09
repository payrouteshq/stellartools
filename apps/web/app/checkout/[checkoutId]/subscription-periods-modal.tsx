"use client";

import { formatPeriod } from "@/app/dashboard/(dashboard)/subscriptions/_shared";
import { useCheckout } from "@/contexts/checkout-context";
import { truncate } from "@/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@stellartools/shared-ui";
import { Minus, Plus } from "lucide-react";

export function SubscriptionPeriodsModal() {
  const { checkout, subscriptionPeriods } = useCheckout();

  if (checkout?.productType !== "subscription") return null;

  const { open, close, selected, setSelected, quote, quoteError, isLoading, confirm } = subscriptionPeriods;
  const billingPeriodLabel = checkout.recurringPeriod
    ? formatPeriod(checkout.recurringPeriod, checkout.customDurationMs).replace("every ", "")
    : "billing period";

  const maxSelectable = quote ? Math.max(quote.maxAffordablePeriods, 1) : 1;
  const assetLabel = quote
    ? `${quote.sourceAssetCode}${quote.sourceAssetIssuer ? ` (${truncate(quote.sourceAssetIssuer, { start: 4, end: 4 })})` : ""}`
    : "";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fund future billing periods now?</DialogTitle>
          <DialogDescription>
            Only the first {billingPeriodLabel} is charged now. Anything extra you fund stays in your wallet and
            is charged automatically at each future renewal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={selected <= 1}
              onClick={() => setSelected(Math.max(1, selected - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <div className="w-20 text-center">
              <p className="text-2xl font-semibold tabular-nums">{selected}</p>
              <p className="text-muted-foreground text-xs">{selected === 1 ? "period" : "periods"}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={selected >= maxSelectable}
              onClick={() => setSelected(Math.min(maxSelectable, selected + 1))}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner className="size-3.5" /> Checking your balance...
            </p>
          ) : quoteError ? (
            <p className="text-muted-foreground text-sm">Could not check your balance. Proceeding with 1 period.</p>
          ) : quote ? (
            quote.maxAffordablePeriods < 1 ? (
              <p className="text-destructive text-sm">
                You may not have enough {assetLabel} yet to fund even one period. You can still continue, and the
                payment step will confirm.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Up to {quote.maxAffordablePeriods} {quote.maxAffordablePeriods === 1 ? "period" : "periods"}{" "}
                available from your {assetLabel} balance right now.
              </p>
            )
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
