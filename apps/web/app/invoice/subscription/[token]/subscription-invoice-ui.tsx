"use client";

import * as React from "react";

import { PublicSubscriptionInvoice, paySubscriptionInvoice } from "@/actions/subscription";
import { StellarToolsIcon } from "@/components/icon";
import { TxStatus, useWallet } from "@/contexts/wallet-context";
import { Money } from "@/lib/money";
import { Button, Spinner, toast } from "@stellartools/shared-ui";
import { Building2, CheckCircle2, FileText } from "lucide-react";
import moment from "moment";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SubscriptionInvoiceUI({ invoice }: { invoice: NonNullable<PublicSubscriptionInvoice> }) {
  const wallet = useWallet();
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const isPaid = invoice.status !== "overdue";

  React.useEffect(() => {
    wallet.setEnvironment(invoice.environment);
  }, [invoice.environment, wallet]);

  const handlePay = () => {
    if (!wallet.connected) {
      void wallet.connect((connected) => {
        if (!connected) toast.error("Wallet connection failed");
      });
      return;
    }

    startTransition(async () => {
      wallet.setTxStatus(TxStatus.SUBMITTING);
      try {
        await paySubscriptionInvoice(invoice.token, wallet.walletAddress);
        wallet.setTxStatus(TxStatus.SUCCESS);
        toast.success("Invoice paid");
        router.refresh();
      } catch (error) {
        wallet.setTxStatus(TxStatus.FAIL);
        toast.error(error instanceof Error ? error.message : "Payment failed");
      }
    });
  };

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-between px-4 py-10">
      <main className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-3">
          {invoice.merchant.logoUrl ? (
            <Image
              src={invoice.merchant.logoUrl}
              alt={invoice.merchant.name}
              width={36}
              height={36}
              className="size-9 rounded-lg object-contain"
            />
          ) : (
            <div className="bg-muted border-border flex size-9 items-center justify-center rounded-lg border">
              <Building2 className="text-foreground size-4" />
            </div>
          )}
          <span className="text-foreground font-semibold">{invoice.merchant.name}</span>
        </div>

        <section className="bg-card border-border rounded-2xl border px-6 py-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
                <FileText className="text-muted-foreground size-8" />
              </div>
              {isPaid && (
                <div className="bg-background absolute -right-1 -bottom-1 rounded-full">
                  <CheckCircle2 className="text-primary fill-primary-foreground size-5" />
                </div>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{isPaid ? "Invoice paid" : "Payment overdue"}</p>
              <p className="text-foreground mt-1 text-3xl font-bold tracking-tight">
                {Money.formatFiat(invoice.amountCents, invoice.currencyCode)}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{invoice.productName}</p>
            </div>
          </div>

          <div className="border-border divide-border divide-y border-t">
            <DetailRow label="Invoice number" value={invoice.subscriptionId} mono />
            {invoice.customer?.email && <DetailRow label="Customer" value={invoice.customer.email} />}
            {isPaid && invoice.lastPayment && (
              <>
                <DetailRow label="Payment date" value={moment(invoice.lastPayment.createdAt).format("MMMM D, YYYY")} />
                <DetailRow
                  label="Payment method"
                  value={`${invoice.lastPayment.cryptoAmount} ${invoice.lastPayment.selectedAssetCode}`}
                />
              </>
            )}
          </div>

          {!isPaid && (
            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={handlePay} disabled={isPending || wallet.isLoading}>
                {isPending || wallet.isLoading ? <Spinner size={14} className="mr-2" /> : null}
                {wallet.connected ? "Pay invoice" : "Connect wallet to pay"}
              </Button>
              {wallet.connected && (
                <p className="text-muted-foreground text-center font-mono text-xs">
                  {wallet.walletAddress.slice(0, 8)}…{wallet.walletAddress.slice(-6)}
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      <Link
        href={process.env.NEXT_PUBLIC_APP_URL!}
        className="text-muted-foreground hover:text-foreground mt-8 flex items-center gap-1.5 text-sm transition-colors"
      >
        Powered by <StellarToolsIcon width={13} height={13} /> <span className="font-medium">StellarTools</span>
      </Link>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`text-foreground text-right text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
