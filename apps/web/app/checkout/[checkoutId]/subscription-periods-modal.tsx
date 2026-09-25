"use client";

import { formatPeriod } from "@/app/dashboard/(dashboard)/subscriptions/_shared";
import { useCheckout } from "@/contexts/checkout-context";
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

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>How many billing periods to fund now?</DialogTitle>
          <DialogDescription>
            Paying for more than one {billingPeriodLabel} up front means your subscription can keep renewing
            automatically without you needing to come back and top up your wallet.
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
            <p className="text-muted-foreground text-sm">Couldn't check your balance — proceeding with 1 period.</p>
          ) : quote ? (
            quote.maxAffordablePeriods < 1 ? (
              <p className="text-destructive text-sm">
                Your {quote.sourceAssetCode} balance may not cover even one period yet — you can still continue,
                but the payment step will tell you if it's not enough.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Funded from your {quote.sourceAssetCode} balance — up to {quote.maxAffordablePeriods}{" "}
                {quote.maxAffordablePeriods === 1 ? "period" : "periods"} available right now.
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
