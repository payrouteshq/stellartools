"use client";

import * as React from "react";

import { StellarTools } from "@/components/icon";
import { CustomerReceipt } from "@/components/receipt-engine";
import { ResolvedPayment } from "@/db";
import { Money } from "@/lib/money";
import { downloadReceipt, truncate } from "@/lib/utils";
import { Button, Spinner, toast } from "@stellartools/shared-ui";
import { Building2, CheckCircle2, ExternalLink } from "lucide-react";
import moment from "moment";

interface InvoiceUIProps {
  resolvedPayment: ResolvedPayment;
}

function getExplorerUrl(hash: string, environment: string) {
  const network = environment === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

export function InvoiceUI({ resolvedPayment }: InvoiceUIProps) {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (resolvedPayment.org && resolvedPayment.customer) {
      setDownloading(true);
      try {
        const downloadPromise = downloadReceipt(
          <CustomerReceipt
            paymentStatus={resolvedPayment.status}
            environment={resolvedPayment.environment}
            organizationName={resolvedPayment.org?.name ?? "StellarTools"}
            organizationAddress={resolvedPayment.org?.address ?? ""}
            organizationEmail={resolvedPayment.org?.supportEmail ?? ""}
            organizationLogo={resolvedPayment.org?.logoUrl ?? ""}
            paymentId={resolvedPayment.id}
            paymentAmountCents={resolvedPayment.amountCents}
            paymentCurrencyCode={resolvedPayment.currencyCode}
            paymentCryptoAmount={Number(resolvedPayment.cryptoAmount)}
            paymentSelectedAssetCode={resolvedPayment.selectedAssetCode}
            paymentTransactionHash={resolvedPayment.transactionHash}
            paymentCreatedAt={resolvedPayment.createdAt}
            customerName={resolvedPayment.customer?.name ?? ""}
            customerEmail={resolvedPayment.customer?.email ?? ""}
          />,
          `receipt-${resolvedPayment.id}`
        );
        toast.promise(downloadPromise, {
          loading: "Generating receipt...",
          success: "Receipt downloaded successfully",
          error: "Failed to generate receipt",
        });
      } finally {
        setDownloading(false);
      }
    }
  };

  const isPaid = resolvedPayment.status === "confirmed";
  const fiatAmount = Money.formatFiat(resolvedPayment.amountCents, resolvedPayment.currencyCode);
  const explorerUrl = getExplorerUrl(resolvedPayment.transactionHash, resolvedPayment.environment);

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-between px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-3">
          {resolvedPayment.org?.logoUrl ? (
            <img
              src={resolvedPayment.org.logoUrl}
              alt={resolvedPayment.org.name}
              className="size-9 rounded-lg object-contain"
            />
          ) : (
            <div className="bg-foreground/5 border-border flex size-9 items-center justify-center rounded-lg border">
              <Building2 className="text-foreground size-4" />
            </div>
          )}
          <span className="text-foreground text-base font-semibold">{resolvedPayment.org?.name ?? "StellarTools"}</span>
        </div>

        <div className="bg-card border-border rounded-2xl border px-6 py-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="bg-muted/40 flex size-16 items-center justify-center rounded-2xl">
                <svg width="28" height="34" viewBox="0 0 28 34" fill="none" className="text-muted-foreground/40">
                  <rect x="1" y="1" width="26" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="7" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="7" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="7" y1="20" x2="15" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              {isPaid && (
                <div className="absolute -right-1 -bottom-1 rounded-full bg-white">
                  <CheckCircle2 className="size-5 fill-green-500 text-white" />
                </div>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{isPaid ? "Invoice paid" : "Invoice pending"}</p>
              <p className="text-foreground mt-1 text-3xl font-bold tracking-tight">{fiatAmount}</p>
            </div>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              View on Stellar Explorer
              <ExternalLink className="size-3" />
            </a>
          </div>

          <div className="border-border divide-border divide-y border-t">
            <DetailRow label="Invoice number" value={resolvedPayment.id} mono />
            <DetailRow label="Payment date" value={moment(resolvedPayment.createdAt).format("MMMM D, YYYY")} />
            <DetailRow
              label="Transaction"
              value={truncate(resolvedPayment.transactionHash, { start: 10, end: 6 })}
              mono
              href={explorerUrl}
            />
            <DetailRow
              label="Environment"
              value={resolvedPayment.environment === "mainnet" ? "Live mode" : "Test mode"}
            />
            {resolvedPayment.customer?.name && <DetailRow label="Customer" value={resolvedPayment.customer.name} />}
            {resolvedPayment.customer?.email && <DetailRow label="Email" value={resolvedPayment.customer.email} />}
            <DetailRow
              label="Amount (crypto)"
              value={`${resolvedPayment.cryptoAmount} ${resolvedPayment.selectedAssetCode}`}
              mono
            />
          </div>

          <Button className="mt-6 w-full" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Spinner size={14} className="mr-2" /> : null}
            Download receipt
          </Button>
        </div>
      </div>

      <a
        href={process.env.NEXT_PUBLIC_APP_URL!}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground mt-8 flex items-center gap-1.5 text-sm transition-colors"
      >
        Powered by
        <StellarTools width={13} height={13} className="shrink-0" />
        <span className="font-medium">StellarTools</span>
      </a>
    </div>
  );
}

function DetailRow({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-primary text-sm hover:underline ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </a>
      ) : (
        <span className={`text-foreground text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
      )}
    </div>
  );
}
