"use client";

import { CheckoutSkeleton } from "@/app/checkout/[checkoutId]/checkout-skeleton";
import { formatPeriod } from "@/app/dashboard/(dashboard)/subscriptions/_shared";
import { TestModeBanner } from "@/components/environment-mode";
import { AnimatedCheckmark, StellarToolsIcon } from "@/components/icon";
import { useCheckout } from "@/contexts/checkout-context";
import { Money } from "@/lib/money";
import { truncate } from "@/lib/utils";
import {
  Button,
  PhoneNumber,
  PhoneNumberField,
  SelectField,
  Separator,
  Skeleton,
  TextField,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@stellartools/shared-ui";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as RHF from "react-hook-form";

export default function CheckoutUI() {
  const {
    id: checkoutId,
    checkout,
    isLoading,
    isPaid,
    isFailed,
    hasDetails,
    form,
    updateDetails,
    wallet,
    banner,
    publicData,
    publicDataLoading,
    selectedAsset,
    setSelectedAsset,
    cryptoAmount,
  } = useCheckout();

  const fiatDisplay = checkout?.finalAmount
    ? Money.formatFiat(checkout.finalAmount, checkout.currencyCode ?? "USD")
    : null;

  const trialDays = (checkout?.subscriptionData as { trial_days?: number } | null | undefined)?.trial_days ?? 0;
  const billingPeriodLabel =
    checkout?.productType === "subscription" && checkout.recurringPeriod
      ? formatPeriod(checkout.recurringPeriod, checkout.customDurationMs)
      : null;

  if (isLoading) return <Checkout.Skeleton />;
  if (!checkout) return notFound();

  if (isPaid) {
    if (typeof window !== "undefined" && checkout.redirectUrl) {
      window.location.replace(checkout.redirectUrl);
      return null;
    }
    return <Checkout.Success />;
  }
  if (isFailed) return <Checkout.Error checkoutId={checkoutId} onRetry={() => window.location.reload()} />;

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {banner.show && checkout.environment === "testnet" && <TestModeBanner />}

      <div
        className={cn(
          "grid flex-1 grid-cols-1 lg:grid-cols-2",
          checkout.environment === "testnet" && "pt-8 transition-all duration-300"
        )}
      >
        {/* Order summary — always light */}
        <div className="border-border flex flex-col justify-center border-b px-6 py-12 sm:px-10 sm:py-16 lg:border-r lg:border-b-0 lg:px-16 lg:py-16">
          <div className="mx-auto w-full max-w-md space-y-8">
            {(checkout.organizationName || checkout.organizationLogo) && (
              <div className="flex items-center gap-3">
                {checkout.organizationLogo && (
                  <div className="relative size-8 shrink-0 overflow-hidden rounded-md">
                    <Image
                      src={checkout.organizationLogo}
                      alt=""
                      width={32}
                      height={32}
                      className="size-full object-contain"
                    />
                  </div>
                )}
                <span className="text-muted-foreground text-sm font-medium">
                  {checkout.organizationName || "Merchant"}
                </span>
              </div>
            )}

            {checkout.productImage && (
              <div className="bg-muted/30 relative h-40 w-full overflow-hidden rounded-xl">
                <Image src={checkout.productImage} alt="" fill className="object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Paying for</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{checkout.productName}</h1>
              {checkout.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">{checkout.description}</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                {fiatDisplay ? (
                  <div className="flex items-baseline whitespace-nowrap text-3xl font-bold tracking-tight sm:text-4xl">
                    {fiatDisplay}
                    {checkout.productType === "subscription" && checkout.recurringPeriod && (
                      <span className="text-muted-foreground ml-1 text-sm font-normal tracking-normal">
                        / {billingPeriodLabel}
                      </span>
                    )}
                  </div>
                ) : (
                  <Skeleton className="h-10 w-48 rounded-md" />
                )}

                {(publicData?.assets?.length ?? 0) > 0 && (
                  <SelectField
                    id="pay-with-asset"
                    value={selectedAsset?.code ?? ""}
                    onChange={(code) => {
                      const asset = publicData?.assets?.find((a) => a.code === code);
                      if (asset) {
                        setSelectedAsset({ code: asset.code, canonicalIssuer: asset.canonicalIssuer ?? null });
                      }
                    }}
                    isLoading={publicDataLoading}
                    placeholder="Pay in"
                    className="w-fit shrink-0"
                    triggerClassName="h-8 w-fit shrink-0 gap-1.5 rounded-full border-none bg-accent px-3 text-xs font-semibold shadow-none"
                    items={(publicData?.assets ?? []).map((asset) => {
                      const imageUrl = asset.images?.[0];
                      return {
                        value: asset.code,
                        label: `Pay in ${asset.code}`,
                        icon: imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={asset.code}
                            width={16}
                            height={16}
                            className="size-4 shrink-0 rounded-full object-cover"
                          />
                        ) : null,
                      };
                    })}
                  />
                )}
              </div>
              {trialDays > 0 && (
                <p className="text-muted-foreground text-sm font-medium">
                  {trialDays}-day free trial
                  {billingPeriodLabel ? `, then billed every ${billingPeriodLabel.replaceAll("every ", "")}` : ""}
                </p>
              )}
              {selectedAsset && cryptoAmount && (
                <p className="text-muted-foreground text-sm">
                  ≈ {cryptoAmount} {selectedAsset.code}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          id="checkout-payment-panel"
          className="dark bg-background -mt-2 text-foreground flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!hasDetails) {
                form.handleSubmit((d) => updateDetails.mutate(d))();
              } else {
                wallet.handleWalletPay();
              }
            }}
            className="mx-auto w-full max-w-md space-y-8"
          >
            {checkout.customerImage && (
              <div className="flex items-center gap-3">
                <div className="border-border bg-muted relative size-12 shrink-0 overflow-hidden rounded-full border">
                  <Image src={checkout.customerImage} alt="" fill className="object-cover" sizes="48px" />
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Paying as</p>
                  <p className="truncate text-sm font-medium">{checkout.customerEmail || "Customer"}</p>
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold tracking-tight">Contact information</h2>

            <div className="space-y-4">
              <RHF.Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    id={field.name}
                    label="Billing Email"
                    className="shadow-none"
                    disabled={hasDetails}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <RHF.Controller
                name="phoneNumber"
                control={form.control}
                render={({ field, fieldState }) => {
                  const fieldValue: PhoneNumber = {
                    number: field.value?.number || "",
                    countryCode: field.value?.countryCode || "US",
                  };
                  return (
                    <PhoneNumberField
                      value={fieldValue}
                      onChange={field.onChange}
                      id={field.name}
                      label="Phone Number"
                      disabled={hasDetails}
                      error={(fieldState.error as any)?.number?.message}
                      groupClassName="w-full shadow-none"
                    />
                  );
                }}
              />
            </div>

            <AnimatePresence mode="wait">
              {!hasDetails ? (
                <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Button type="submit" className="h-9 w-full font-semibold" isLoading={updateDetails.isPending}>
                    Continue to Payment
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <Button
                    type="submit"
                    className={cn(
                      "h-12 flex-1 text-base font-semibold",
                      wallet.isProcessing && "pointer-events-none opacity-80"
                    )}
                    isLoading={wallet.isProcessing}
                    disabled={wallet.isProcessing || !selectedAsset}
                  >
                    {wallet.connectedAddress
                      ? `Pay as ${truncate(wallet.connectedAddress, { start: 4, end: 4 })}`
                      : "Connect Wallet"}
                  </Button>
                  {wallet.connectedAddress && !wallet.isProcessing && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-lg"
                            onClick={wallet.disconnect}
                            aria-label="Disconnect wallet"
                          >
                            <X className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Disconnect wallet</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-muted-foreground space-y-2 pt-2 text-center text-xs">
              <p className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                Secure Payment
              </p>
              <p className="flex items-center justify-center gap-1.5">
                <StellarToolsIcon className="size-3.5" />
                <span className="font-semibold">Stellar Tools</span>
                <span className="text-border">|</span>
                <Link href="/terms" className="hover:text-foreground underline">
                  Terms
                </Link>
                <span>.</span>
                <Link href="/privacy" className="hover:text-foreground underline">
                  Privacy
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const Checkout = {
  Success: () => (
    <div className="bg-background animate-in fade-in flex min-h-screen flex-col items-center justify-center gap-2 p-6 duration-500">
      <AnimatedCheckmark />
      <div className="flex w-full flex-col items-center justify-center space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment received</h1>
        <p className="text-muted-foreground">This checkout has been completed.</p>
      </div>
    </div>
  ),

  Error: ({ checkoutId, onRetry }: any) => (
    <div className="bg-background animate-in zoom-in-95 flex min-h-screen flex-col items-center justify-center p-6 text-center duration-300">
      <div className="w-full max-w-sm space-y-8">
        <div className="bg-destructive/10 mx-auto flex size-16 items-center justify-center rounded-full">
          <AlertCircle className="text-destructive size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment Failed</h1>
          <p className="text-muted-foreground text-sm">We couldn&apos;t verify your transaction on the ledger.</p>
        </div>
        <div className="border-border flex items-center justify-between border-y py-3 text-left">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Reference</span>
          <span className="font-mono text-sm break-all">{checkoutId}</span>
        </div>
        <Button onClick={onRetry} className="h-11 w-full font-semibold" variant="outline">
          Try Again
        </Button>
      </div>
    </div>
  ),

  Skeleton: CheckoutSkeleton,
};
