"use client";

import * as React from "react";

import { deleteCustomerWallet, getCustomerPortalData, retrieveCustomerPortalSession } from "@/actions/customers";
import { AppModal } from "@/components/app-modal";
import { StellarTools } from "@/components/icon";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useAction } from "@/hooks/use-action";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { cn, truncate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Edit2, Plus, Wallet } from "lucide-react";
import moment from "moment";
import Link from "next/link";

type PortalData = Awaited<ReturnType<typeof getCustomerPortalData>>;
type Credit = NonNullable<PortalData>["credits"][number];
type Payment = NonNullable<PortalData>["payments"][number];
type WalletEntry = NonNullable<PortalData>["wallets"][number];
type Organization = NonNullable<PortalData>["organization"];

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-portal", token],
    queryFn: () => getCustomerPortalData(token),
    enabled: !!token,
  });

  const [actionId, setActionId] = React.useState<string | null>(null);

  const { mutate: makeSubscriptionMutation } = useAction(
    async ({ path, subscriptionId }: { path: string; subscriptionId: string; successMessage: string }) => {
      setActionId(subscriptionId);
      const { ApiClient } = await import("@stellartools/core");
      const api = new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL!, headers: {} });
      const response = await api.post(`/subscriptions/${subscriptionId}/${path}`, {
        headers: { "x-portal-token": token },
      });
      if (response.isErr()) throw new AppError(response.error.message);
      return response.value;
    },
    {
      onSuccess: () => setActionId(null),
      onError: () => setActionId(null),
      invalidate: [["customer-portal", token]],
      successMsg: (_, args) => args.successMessage,
    }
  );

  const { mutate: deleteWalletAction, isPending: isDeletingWallet } = useAction(
    async (walletId: string) => {
      const session = await retrieveCustomerPortalSession(token);
      if (!session) throw new AppError("Invalid or expired session");
      const { customerId, organizationId, environment } = session;
      return await deleteCustomerWallet(customerId, walletId, organizationId, environment);
    },
    { invalidate: [["customer-portal", token]], successMsg: "Wallet removed", errorMsg: "Failed to remove wallet" }
  );

  const handleCancel = (subscriptionId: string) => {
    AppModal.open({
      title: "Cancel subscription",
      description: "Cancel this subscription at the end of the current period?",
      content: (
        <p className="text-muted-foreground text-sm">
          You will keep access until the end of your current billing period.
        </p>
      ),
      size: "small",
      showCloseButton: true,
      secondaryButton: { children: "Keep subscription" },
      primaryButton: {
        children: "Cancel at period end",
        variant: "destructive",
        onClick: () => {
          AppModal.close();
          makeSubscriptionMutation({ path: "cancel", subscriptionId, successMessage: "Subscription canceled" });
        },
      },
    });
  };

  const handlePause = (subscriptionId: string) => {
    AppModal.open({
      title: "Pause subscription",
      description: "Pause this subscription?",
      content: (
        <p className="text-muted-foreground text-sm">
          Your subscription will be paused immediately. You can resume it at any time.
        </p>
      ),
      size: "small",
      showCloseButton: true,
      secondaryButton: { children: "Keep active" },
      primaryButton: {
        children: "Pause",
        onClick: () => {
          AppModal.close();
          makeSubscriptionMutation({ path: "pause", subscriptionId, successMessage: "Subscription paused" });
        },
      },
    });
  };

  const handleDeleteWallet = (wallet: WalletEntry) => {
    AppModal.open({
      title: "Remove wallet",
      description: `Remove ${truncate(wallet.address, { start: 6, end: 6 })}?`,
      content: (
        <p className="text-muted-foreground text-sm">
          This wallet will be unlinked from your account. Wallets tied to active subscriptions cannot be removed.
        </p>
      ),
      size: "small",
      showCloseButton: true,
      secondaryButton: { children: "Keep wallet" },
      primaryButton: {
        children: "Remove",
        variant: "destructive",
        onClick: () => {
          AppModal.close();
          deleteWalletAction(wallet.id);
        },
      },
    });
  };

  if (isLoading) return <PortalSkeleton />;

  if (!data?.customer) {
    return (
      <div className="bg-background flex min-h-screen">
        <PortalSidebar org={null} testnet={false} token={token} />
        <main className="flex flex-1 flex-col">
          <MobileOrgHeader org={null} testnet={false} />
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-foreground text-lg font-semibold">Session expired or not found</p>
              <p className="text-muted-foreground mt-1 text-sm">Contact the merchant for a new link.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { customer, organization, subscriptions, payments, credits, wallets } = data;
  const testnet = data.environment === "testnet";
  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing" || s.status === "paused"
  );
  const activeWalletIds = new Set(activeSubscriptions.map((s) => s.customerWalletId).filter(Boolean));

  return (
    <div className="bg-background flex min-h-screen">
      <PortalSidebar org={organization} testnet={testnet} token={token} />

      <main className="flex-1 overflow-auto">
        <MobileOrgHeader org={organization} testnet={testnet} />
        <div className="mx-auto max-w-2xl space-y-10 px-6 py-12">
          {/* Active subscriptions */}
          {activeSubscriptions.map((sub) => (
            <section key={sub.id}>
              <SectionLabel>Current subscription</SectionLabel>
              <div className="border-border rounded-xl border px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-foreground font-medium">{sub.productName ?? "Subscription"}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {sub.cancelAtPeriodEnd ? (
                        <Badge variant="outline">Canceling</Badge>
                      ) : sub.status === "paused" ? (
                        <Badge variant="secondary">Paused</Badge>
                      ) : sub.status === "trialing" ? (
                        <Badge variant="secondary">Trial</Badge>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {sub.cancelAtPeriodEnd
                        ? `Cancels ${moment(sub.currentPeriodEnd).format("MMM D, YYYY")}`
                        : sub.status === "paused"
                          ? "Paused — no charges until resumed"
                          : `Renews ${moment(sub.currentPeriodEnd).format("MMM D, YYYY")}`}
                    </p>
                    {sub.walletAddress && (
                      <p className="text-muted-foreground font-mono text-xs">
                        {truncate(sub.walletAddress, { start: 8, end: 8 })}
                      </p>
                    )}
                  </div>
                  {!sub.cancelAtPeriodEnd && (
                    <div className="flex shrink-0 items-center gap-2">
                      {sub.status === "paused" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionId === sub.id}
                          onClick={() =>
                            makeSubscriptionMutation({
                              path: "resume",
                              subscriptionId: sub.id,
                              successMessage: "Subscription resumed",
                            })
                          }
                        >
                          {actionId === sub.id ? "Resuming…" : "Resume"}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          disabled={actionId === sub.id}
                          onClick={() => handlePause(sub.id)}
                        >
                          Pause
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionId === sub.id}
                        onClick={() => handleCancel(sub.id)}
                      >
                        Cancel subscription
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ))}

          {/* Payment methods */}
          <section>
            <SectionLabel>Payment methods</SectionLabel>
            <div className="border-border divide-border divide-y rounded-xl border">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                      <Wallet className="text-muted-foreground size-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-foreground font-mono text-sm">
                        {truncate(wallet.address, { start: 8, end: 8 })}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-muted-foreground text-xs">
                          Added {moment(wallet.createdAt).format("MMM D, YYYY")}
                        </p>
                        {activeWalletIds.has(wallet.id) && (
                          <Badge variant="secondary" className="text-[10px]">
                            Active subscription
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs"
                    onClick={() => handleDeleteWallet(wallet)}
                    disabled={isDeletingWallet || activeWalletIds.has(wallet.id)}
                    title={
                      activeWalletIds.has(wallet.id)
                        ? "Cannot remove a wallet linked to an active subscription"
                        : "Remove"
                    }
                  >
                    ···
                  </Button>
                </div>
              ))}
              <div className="px-5 py-3.5">
                <Link
                  href={`/${token}/payment-methods`}
                  className="text-foreground hover:text-foreground/80 flex items-center gap-1.5 text-sm transition-colors"
                >
                  <Plus className="size-4" />
                  Add payment method
                </Link>
              </div>
            </div>
          </section>

          {/* Billing information */}
          <section>
            <SectionLabel>Billing information</SectionLabel>
            <div className="border-border rounded-xl border">
              <div className="divide-border divide-y px-5">
                {customer.name && <InfoRow label="Name" value={customer.name} />}
                {customer.email && <InfoRow label="Email" value={customer.email} />}
                {customer.phone && <InfoRow label="Phone" value={customer.phone} />}
              </div>
              <div className="border-border border-t px-5 py-3.5">
                <Link
                  href={`/${token}/customer/update`}
                  className="text-foreground hover:text-foreground/80 flex items-center gap-1.5 text-sm transition-colors"
                >
                  <Edit2 className="size-3.5" />
                  Update information
                </Link>
              </div>
            </div>
          </section>

          {/* Usage / Credits */}
          {credits.length > 0 && (
            <section>
              <SectionLabel>Usage</SectionLabel>
              <div className="border-border divide-border divide-y rounded-xl border">
                {credits.map((c, i) => (
                  <CreditMeter key={i} credit={c} />
                ))}
              </div>
            </section>
          )}

          {/* Invoice history */}
          {payments.length > 0 && (
            <section>
              <SectionLabel>Invoice history</SectionLabel>
              <div className="border-border divide-border divide-y rounded-xl border">
                {payments.map((p) => (
                  <InvoiceRow key={p.id} payment={p} />
                ))}
              </div>
            </section>
          )}

          {activeSubscriptions.length === 0 &&
            wallets.length === 0 &&
            payments.length === 0 &&
            credits.length === 0 && (
              <div className="border-border rounded-xl border py-16 text-center">
                <p className="text-foreground font-medium">No activity yet</p>
                <p className="text-muted-foreground mt-1 text-sm">Subscriptions and payments will appear here.</p>
              </div>
            )}

          <Link
            href="https://stellartools.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 text-xs transition-colors"
          >
            Powered by
            <StellarTools width={13} height={13} className="shrink-0" />
            StellarTools
          </Link>
        </div>
      </main>
    </div>
  );
}

// -- Shared sidebar --

function PortalSidebar({ org, testnet, token }: { org: Organization | null; testnet: boolean; token: string }) {
  const websiteUrl = (org?.socialLinks as Record<string, string> | null)?.website;

  return (
    <aside className="border-border bg-background hidden w-[280px] shrink-0 flex-col border-r px-8 py-10 md:flex">
      {/* Logo + name */}
      <div className="mb-6 flex items-center gap-3">
        {org?.logoUrl ? (
          <img src={org.logoUrl} alt={org.name} className="size-8 rounded-md object-contain" />
        ) : (
          <StellarTools width={28} height={28} className="shrink-0 object-contain" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-foreground truncate text-sm font-semibold">{org?.name ?? "StellarTools"}</span>
        </div>
      </div>

      {org?.name && (
        <p className="text-foreground mb-auto text-sm leading-relaxed">
          {org.name} partners with StellarTools for simplified billing.
        </p>
      )}

      <div className="mt-10 flex items-center justify-between">
        {websiteUrl ? (
          <Link
            href={websiteUrl}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            Return to {org?.name}
          </Link>
        ) : (
          <span />
        )}
        <ModeToggle />
      </div>
    </aside>
  );
}

function MobileOrgHeader({ org, testnet }: { org: Organization | null; testnet: boolean }) {
  return (
    <div className="border-border flex items-center justify-between border-b px-4 py-3 md:hidden">
      <div className="flex items-center gap-2.5">
        {org?.logoUrl ? (
          <img src={org.logoUrl} alt={org.name} className="size-7 rounded-md object-contain" />
        ) : (
          <StellarTools width={24} height={24} className="shrink-0 object-contain" />
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-foreground text-sm font-semibold">{org?.name ?? "StellarTools"}</span>
        </div>
      </div>
      <ModeToggle />
    </div>
  );
}

// -- Section helpers --

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">{children}</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <span className="text-muted-foreground w-20 shrink-0 text-sm">{label}</span>
      <span className="text-foreground min-w-0 truncate text-sm">{value}</span>
    </div>
  );
}

function CreditMeter({ credit }: { credit: Credit }) {
  const total = credit.totalCredits ?? BigInt(0);
  const pct = total > 0 ? Math.min((Number(credit.consumed) / Number(total)) * 100, 100) : 0;
  const unit = credit.productUnit ?? "credits";

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-foreground text-sm font-medium">{credit.productName ?? "Usage"}</p>
        <p className="text-muted-foreground text-xs">
          {credit.consumed.toLocaleString()} / {total.toLocaleString()} {unit}
        </p>
      </div>
      <Slider
        value={[pct]}
        min={0}
        max={100}
        disabled
        className="**:data-[slot=slider-thumb]:size-3"
        showKnobs={false}
      />
      <p className="text-muted-foreground text-xs">
        {credit.balance.toLocaleString()} {unit} remaining
      </p>
    </div>
  );
}

function InvoiceRow({ payment }: { payment: Payment }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-medium">
          {Money.formatCrypto(payment.cryptoAmount, payment.selectedAssetCode)}
        </p>
        <p className="text-muted-foreground text-xs">{moment(payment.createdAt).format("MMM D, YYYY")}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground font-mono text-xs">{payment.transactionHash.slice(0, 8)}…</span>
        <Badge variant="secondary">Paid</Badge>
      </div>
    </div>
  );
}

// -- Skeleton --

function PortalSkeleton() {
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border hidden w-[280px] shrink-0 flex-col gap-4 border-r px-8 py-10 md:flex">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-10 px-6 py-12">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <div className="border-border rounded-xl border">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between px-5 py-3.5">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
