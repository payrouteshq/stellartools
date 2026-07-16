"use client";

import * as React from "react";

import {
  deleteCustomerWallet,
  getCustomerPortalData,
  retrieveCustomerPortalSession,
  upsertCustomerWallet,
} from "@/actions/customers";
import { ModeToggle } from "@/components/mode-toggle";
import { useWallet } from "@/contexts/wallet-context";
import { useAction } from "@/hooks/use-action";
import { AppError } from "@/lib/action-handler";
import { truncate } from "@/lib/utils";
import { AppModal, Badge, Button, Separator, Skeleton } from "@stellartools/shared-ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, Link2, Trash2, Wallet } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { useRouter } from "next/navigation";

type PortalData = Awaited<ReturnType<typeof getCustomerPortalData>>;
type WalletEntry = NonNullable<PortalData>["wallets"][number];
type Organization = NonNullable<PortalData>["organization"];

export default function PaymentMethodsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params);
  const router = useRouter();
  const wallet = useWallet();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-portal", token],
    queryFn: () => getCustomerPortalData(token),
    enabled: !!token,
  });

  React.useEffect(() => {
    if (data?.environment) wallet.setEnvironment(data.environment);
  }, [data?.environment]);

  const activeSubscriptions =
    data?.subscriptions?.filter((s) => s.status === "active" || s.status === "trialing" || s.status === "paused") ?? [];
  const activeWalletIds = new Set(activeSubscriptions.map((s) => s.customerWalletId).filter(Boolean));

  const { mutate: linkWallet, isPending: isLinking } = useAction(
    async (address: string) => {
      const session = await retrieveCustomerPortalSession(token);
      if (!session) throw new AppError("Invalid or expired session");
      const { customerId, organizationId, environment } = session;
      return await upsertCustomerWallet(customerId, { walletAddress: address }, organizationId, environment);
    },
    {
      invalidate: [["customer-portal", token]],
      successMsg: "Wallet linked successfully",
      onSuccess: () => wallet.disconnect(),
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

  const handleDeleteWallet = (entry: WalletEntry) => {
    AppModal.open({
      title: "Remove wallet",
      description: `Remove ${truncate(entry.address, { start: 6, end: 6 })}?`,
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
          deleteWalletAction(entry.id);
        },
      },
    });
  };

  if (isLoading) return <PageSkeleton />;

  if (!data?.customer) return null;

  const wallets = data.wallets ?? [];
  const walletAlreadyLinked = wallet.connected ? wallets.some((w) => w.address === wallet.walletAddress) : false;

  return (
    <div className="bg-background flex min-h-screen">
      <PortalSidebar org={data.organization} />

      <main className="flex-1 overflow-auto">
        <MobileOrgHeader org={data.organization} />
        <div className="mx-auto max-w-2xl px-6 py-12">
          <nav className="text-muted-foreground mb-8 flex items-center gap-1.5 text-sm">
            <Link href={`/${token}`} className="hover:text-foreground transition-colors">
              Billing
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground">Payment methods</span>
          </nav>

          <h1 className="text-foreground mb-8 text-2xl font-semibold">Payment methods</h1>

          <div className="space-y-8">
            {wallets.length > 0 && (
              <section>
                <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                  Connected wallets
                </p>
                <div className="border-border divide-border divide-y rounded-xl border">
                  {wallets.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
                          <Wallet className="text-muted-foreground size-4" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-foreground font-mono text-sm">
                            {truncate(entry.address, { start: 8, end: 8 })}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-muted-foreground text-xs">
                              Added {moment(entry.createdAt).format("MMM D, YYYY")}
                            </p>
                            {activeWalletIds.has(entry.id) && (
                              <Badge variant="secondary" className="text-[10px]">
                                Active subscription
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                        onClick={() => handleDeleteWallet(entry)}
                        disabled={isDeletingWallet || activeWalletIds.has(entry.id)}
                        title={
                          activeWalletIds.has(entry.id)
                            ? "Cannot remove a wallet linked to an active subscription"
                            : "Remove wallet"
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                Connect a wallet
              </p>
              <div className="border-border rounded-xl border">
                {wallet.connected ? (
                  <div className="space-y-5 p-5">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-full">
                        <Wallet className="text-primary size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-foreground font-mono text-sm">
                          {truncate(wallet.walletAddress, { start: 10, end: 10 })}
                        </p>
                        {walletAlreadyLinked ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="text-primary size-3.5" />
                            <p className="text-primary text-xs">Already linked to your account</p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs">Ready to link</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground shrink-0 text-xs"
                        onClick={wallet.disconnect}
                      >
                        Disconnect
                      </Button>
                    </div>

                    {!walletAlreadyLinked && (
                      <Button
                        className="w-full"
                        onClick={() => linkWallet(wallet.walletAddress)}
                        isLoading={isLinking}
                        disabled={isLinking}
                      >
                        <Link2 className="mr-2 size-4" />
                        Link this wallet
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 px-5 py-12 text-center">
                    <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                      <Wallet className="text-muted-foreground size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-foreground text-sm font-medium">Connect a Stellar wallet</p>
                      <p className="text-muted-foreground max-w-xs text-sm">
                        Link your Stellar wallet to manage subscriptions and make payments.
                      </p>
                    </div>
                    <Button
                      onClick={() => wallet.connect(() => {})}
                      isLoading={wallet.isLoading}
                      disabled={wallet.isLoading}
                    >
                      <Wallet className="mr-2 size-4" />
                      Connect wallet
                    </Button>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            <Button variant="outline" className="w-full" onClick={() => router.push(`/${token}`)}>
              Go back
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function PortalSidebar({ org }: { org: Organization | null }) {
  const websiteUrl = (org?.socialLinks as Record<string, string> | null)?.website;

  return (
    <aside className="border-border bg-background hidden w-[280px] shrink-0 flex-col border-r px-8 py-10 md:flex!">
      <div className="mb-6 flex items-center gap-3">
        {org?.logoUrl ? (
          <img src={org.logoUrl} alt={org.name} className="size-8 rounded-md object-contain" />
        ) : (
          <Building2 className="text-foreground size-8" />
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

function MobileOrgHeader({ org }: { org: Organization | null }) {
  return (
    <div className="border-border flex items-center justify-between border-b px-4 py-3 md:hidden">
      <div className="flex items-center gap-2.5">
        {org?.logoUrl ? (
          <img src={org.logoUrl} alt={org.name} className="size-7 rounded-md object-contain" />
        ) : (
          <Building2 className="text-foreground size-7" />
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-foreground text-sm font-semibold">{org?.name ?? "StellarTools"}</span>
        </div>
      </div>
      <ModeToggle />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border hidden w-[280px] shrink-0 flex-col gap-4 border-r px-8 py-10 md:flex!">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="mt-2 h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-12">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-40" />
          <div className="space-y-3">
            <Skeleton className="h-3 w-36" />
            <div className="border-border rounded-xl border">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="size-8 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
