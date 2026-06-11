"use client";

import { TestModeBanner } from "@/components/environment-mode";
import { AnimatedCheckmark } from "@/components/icon";
import { PhoneNumber, PhoneNumberField } from "@/components/phone-number-field";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCheckout } from "@/contexts/checkout-context";
import { Money } from "@/lib/money";
import { cn, truncate } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
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
    finalAmountUsdCents,
  } = useCheckout();

  const fiatDisplay = checkout?.finalAmount
    ? Money.formatFiat(checkout.finalAmount, checkout.currencyCode ?? "USD")
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

      <main
        className={cn(
          "mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-start gap-8 px-4 py-10 sm:gap-10 sm:px-6 lg:max-w-6xl lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:px-8",
          checkout.environment === "testnet" && "pt-12 transition-all duration-300"
        )}
      >
        {/* Left — product summary */}
        <div className="space-y-6 lg:sticky lg:top-12">
          <div className="bg-card overflow-hidden rounded-2xl border shadow-sm lg:min-w-[360px]">
            {(checkout.organizationName || checkout.organizationLogo) && (
              <div className="flex items-center gap-3 border-b px-6 py-4">
                {checkout.organizationLogo && (
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={checkout.organizationLogo}
                      alt=""
                      width={40}
                      height={40}
                      className="size-full object-contain p-1"
                    />
                  </div>
                )}
                <span className="text-muted-foreground text-sm font-medium">
                  {checkout.organizationName || "Merchant"}
                </span>
              </div>
            )}
            {checkout.productImage && (
              <div className="bg-muted/30 relative aspect-video w-full border-b">
                <Image src={checkout.productImage} alt="" fill className="object-cover" />
              </div>
            )}
            <div className="space-y-5 p-6 sm:p-8">
              <div>
                <p className="text-muted-foreground mb-1 text-[11px] font-bold tracking-widest uppercase">Paying for</p>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {checkout.productName || "Direct Payment"}
                </h2>
              </div>
              {checkout.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">{checkout.description}</p>
              )}
              <Separator />

              {/* Price display */}
              <div className="space-y-1">
                {fiatDisplay ? (
                  <div className="text-3xl font-black tracking-tighter sm:text-4xl">
                    {fiatDisplay}
                    {checkout.productType === "subscription" && (
                      <span className="text-muted-foreground ml-1 text-sm font-normal">
                        / {checkout.recurringPeriod}
                      </span>
                    )}
                  </div>
                ) : (
                  <Skeleton className="h-10 w-48 rounded-md" />
                )}
                {selectedAsset && cryptoAmount && (
                  <p className="text-muted-foreground text-sm">
                    ≈ {cryptoAmount} {selectedAsset.code}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right — payment form */}
        <Card className="border-primary/10 overflow-hidden rounded-2xl shadow-xl lg:min-w-[400px]">
          <CardContent className="space-y-8 p-6 sm:p-8 lg:p-10">
            <div className="space-y-6">
              {checkout.customerImage && (
                <div className="flex items-center gap-3">
                  <div className="border-border bg-muted relative size-12 shrink-0 overflow-hidden rounded-full border-2">
                    <Image src={checkout.customerImage} alt="" fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">Paying as</p>
                    <p className="text-foreground truncate text-sm font-medium">
                      {checkout.customerEmail || "Customer"}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <RHF.Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      id={field.name}
                      label="Billing Email"
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
                    <Button
                      className="h-12 w-full font-bold"
                      onClick={form.handleSubmit((d) => updateDetails.mutate(d))}
                      isLoading={updateDetails.isPending}
                    >
                      Continue to Payment
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <SelectField
                      id="pay-with-asset"
                      label="Pay with"
                      labelClassName=" text-[11px] font-bold tracking-widest uppercase"
                      value={selectedAsset?.code ?? ""}
                      onChange={(code) => {
                        const asset = publicData?.assets?.find((a) => a.code === code);
                        if (asset) {
                          setSelectedAsset({ code: asset.code, canonicalIssuer: asset.canonicalIssuer ?? null });
                        }
                      }}
                      isLoading={publicDataLoading}
                      placeholder="Select payment asset"
                      items={(publicData?.assets ?? []).map((asset) => {
                        const usdPrice = publicData?.assetUsdPrices?.[asset.code] ?? 0;
                        const cryptoNeeded =
                          usdPrice > 0 && finalAmountUsdCents
                            ? Money.calculateCryptoNeeded(finalAmountUsdCents, usdPrice)
                            : null;
                        const imageUrl = asset.images?.[0];
                        return {
                          value: asset.code,
                          label: cryptoNeeded ? `${asset.code}  ≈ ${cryptoNeeded}` : asset.code,
                          icon: imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={asset.code}
                              width={20}
                              height={20}
                              className="size-5 shrink-0 rounded-full object-cover"
                            />
                          ) : null,
                        };
                      })}
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        className={cn(
                          "h-14 flex-1 text-lg font-bold shadow-lg",
                          wallet.isProcessing && "pointer-events-none opacity-80"
                        )}
                        onClick={wallet.handleWalletPay}
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
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors"
                                onClick={wallet.disconnect}
                                aria-label="Disconnect wallet"
                              >
                                <X className="size-5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Disconnect wallet</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </main>

      <Checkout.Footer />
    </div>
  );
}

const Checkout = {
  Success: () => (
    <div className="bg-background animate-in fade-in flex min-h-screen flex-col items-center justify-center gap-2 p-6 duration-500">
      <AnimatedCheckmark />
      <div className="flex w-full flex-col items-center justify-center space-y-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">Payment received</h1>
        <p className="text-muted-foreground text-lg">This checkout has been completed.</p>
      </div>
    </div>
  ),

  Error: ({ checkoutId, onRetry }: any) => (
    <div className="bg-background animate-in zoom-in-95 flex min-h-screen flex-col items-center justify-center p-6 text-center duration-300">
      <div className="w-full max-w-lg space-y-8">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="text-destructive size-10" />
        </div>
        <div className="space-y-2">
          <b className="text-3xl font-bold tracking-tight sm:text-4xl">Payment Failed</b>
          <p className="text-muted-foreground">We couldn&apos;t verify your transaction on the ledger.</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6 text-left sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground shrink-0 text-xs font-bold tracking-widest uppercase">
              Reference
            </span>
            <span className="text-right font-mono text-sm break-all">{checkoutId}</span>
          </div>
        </div>
        <Button onClick={onRetry} className="h-12 w-full font-bold" variant="outline" size="lg">
          Try Again
        </Button>
      </div>
    </div>
  ),

  Skeleton: () => (
    <div className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-3">
        <Skeleton className="h-3 w-40 rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-5/6 rounded-md" />
        <Skeleton className="h-3 w-2/3 rounded-md" />
      </div>
    </div>
  ),

  Footer: () => (
    <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 border-t px-4 py-12 grayscale transition-all sm:flex-row lg:px-8">
      <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
        © {new Date().getFullYear()} Stellar Tools
      </div>
      <div className="flex gap-6 text-[10px] font-bold tracking-tighter uppercase">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/support">Support</Link>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase">Powered by</span>
        <Image src="/images/integrations/stellar-official.png" alt="" width={16} height={16} />
      </div>
    </footer>
  ),
};
