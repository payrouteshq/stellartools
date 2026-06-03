"use client";

import * as React from "react";

import {
  createCustomerImage,
  deleteCustomerWallet,
  getCustomerPortalData,
  retrieveCustomerPortalSession,
} from "@/actions/customers";
import { AppModal } from "@/components/app-modal";
import { TestModeBanner } from "@/components/environment-mode";
import { FileUpload, type FileWithPreview } from "@/components/file-upload";
import { StellarTools } from "@/components/icon";
import {
  PhoneNumber,
  PhoneNumberField,
  phoneNumberFromString,
  phoneNumberSchema,
  phoneNumberToString,
} from "@/components/phone-number-field";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/toast";
import { useAction } from "@/hooks/use-action";
import { useFilePreview } from "@/hooks/use-file-preview";
import { AppError } from "@/lib/action-handler";
import { cn, formatCurrency, stroopsToXlm, truncate } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import * as RHF from "react-hook-form";
import { z as Schema } from "zod";

type PortalData = Awaited<ReturnType<typeof getCustomerPortalData>>;
type Subscription = NonNullable<PortalData>["subscriptions"][number];
type Credit = NonNullable<PortalData>["credits"][number];
type Payment = NonNullable<PortalData>["payments"][number];
type Wallet = NonNullable<PortalData>["wallets"][number];

const api = new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL!, headers: {} });

const portalFormSchema = Schema.object({
  name: Schema.string().optional().nullable(),
  email: Schema.email().optional().nullable(),
  phoneNumber: phoneNumberSchema,
  image: Schema.custom<FileWithPreview>((val) => val instanceof File)
    .optional()
    .nullable(),
});

type PortalFormData = Schema.infer<typeof portalFormSchema>;

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["customer-portal", token],
    queryFn: () => getCustomerPortalData(token),
    enabled: !!token,
  });

  const { file: imageFile, isLoading: isLoadingImage } = useFilePreview(data?.customer?.image ?? null);

  const form = RHF.useForm({
    resolver: zodResolver(portalFormSchema),
    values: data?.customer
      ? {
          name: data.customer.name ?? "",
          email: data.customer.email ?? "",
          phoneNumber: data.customer.phone
            ? phoneNumberFromString(data.customer.phone)
            : { number: "", countryCode: "US" },
          image: imageFile ?? undefined,
        }
      : undefined,
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: { number: "", countryCode: "US" },
      image: imageFile ?? undefined,
    },
  });

  const [saving, startSave] = React.useTransition();

  const isDirty = form.formState.isDirty;

  const handleSave = form.handleSubmit((formData: PortalFormData) => {
    startSave(async () => {
      let imageUrl: string | null = null;
      const imageFile = formData.image;

      if (imageFile instanceof File) {
        const formDataUpload = new FormData();
        formDataUpload.append("image", imageFile);
        imageUrl = (await createCustomerImage(formDataUpload)) ?? null;
      }

      const phone =
        formData.phoneNumber.number.replace(/\D/g, "").length >= 10 ? phoneNumberToString(formData.phoneNumber) : "";

      const response = await api.put(
        `/customers/${data?.customer?.id}`,
        {
          name: formData.name ?? undefined,
          email: formData.email || undefined,
          phone: phone || undefined,
          ...(imageUrl && { image: imageUrl }),
        },
        { "x-portal-token": token, "x-source": "Customer Portal" }
      );

      if (response.isErr()) {
        toast.error(response.error.message);
        return;
      }

      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["customer-portal", token] });
    });
  });

  const [actionId, setActionId] = React.useState<string | null>(null);

  const { mutate: makeSubscriptionMutation, isPending: isMakingSubscription } = useAction(
    async ({ path, subscriptionId }: { path: string; subscriptionId: string; successMessage: string }) => {
      setActionId(subscriptionId);
      const response = await api.post(`/subscriptions/${subscriptionId}/${path}`, {
        headers: { "x-portal-token": token },
      });
      if (response.isErr()) throw new AppError(response.error.message);
      return response.value;
    },
    {
      onSuccess: () => setActionId(null),
      onError: () => setActionId(null),
      invalidate: ["customer-portal", token],
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
    {
      invalidate: ["customer-portal", token],
      successMsg: "Wallet removed",
      errorMsg: "Failed to remove wallet",
    }
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

  const handleDeleteWallet = (wallet: Wallet) => {
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
      <div className="bg-background flex min-h-screen flex-col">
        <header className="border-border border-b">
          <div className="mx-auto flex max-w-2xl items-center px-4 py-4">
            <Link
              href={process.env.NEXT_PUBLIC_APP_URL!}
              className="text-foreground flex items-center gap-2.5 font-semibold transition-opacity hover:opacity-80"
            >
              <StellarTools width={28} height={28} className="object-contain" />
              <span>StellarTools</span>
            </Link>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-foreground text-lg font-semibold">Session expired or not found</p>
            <p className="text-muted-foreground mt-1 text-sm">Contact the merchant for a new link.</p>
          </div>
        </div>
      </div>
    );
  }

  const { subscriptions, payments, credits, wallets } = data;
  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trialing" || s.status === "paused"
  );
  const activeWalletIds = new Set(activeSubscriptions.map((s) => s.customerWalletId).filter(Boolean));
  const hasActivity = payments.length > 0 || activeSubscriptions.length > 0 || credits.length > 0;

  const image = form.watch("image");

  return (
    <div className="bg-background min-h-screen">
      {data.environment === "testnet" && <TestModeBanner />}
      <header
        className={cn("border-border border-b", data.environment === "testnet" && "pt-8 transition-all duration-300")}
      >
        <div className="mx-auto flex max-w-2xl items-center px-4 py-4">
          <Link
            href={process.env.NEXT_PUBLIC_APP_URL!}
            className="text-foreground flex items-center gap-2.5 font-semibold transition-opacity hover:opacity-80"
          >
            <StellarTools width={28} height={28} className="object-contain" />
            <span>StellarTools</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <div className="relative shrink-0">
            <FileUpload
              label={null}
              shape="circle"
              isLoading={isLoadingImage}
              value={image ? [image] : undefined}
              onFilesChange={(files) => form.setValue("image", files[0], { shouldDirty: true })}
              enableTransformation
              disabled={saving}
              dropzoneAccept={{ "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] }}
              dropzoneMaxSize={5 * 1024 * 1024}
              dropzoneMultiple={false}
              targetFormat="image/png"
              error={form.formState.errors.image?.message}
              placeholder=""
              description=""
              className="w-fit"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-4 sm:w-[320px]">
            <RHF.Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <TextField
                  id="name"
                  label="Name"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Your name"
                  error={fieldState.error?.message ?? null}
                />
              )}
            />
            <RHF.Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <TextField
                  id="email"
                  label="Email"
                  type="email"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="you@example.com"
                  error={fieldState.error?.message ?? null}
                />
              )}
            />
            <RHF.Controller
              control={form.control}
              name="phoneNumber"
              render={({ field, fieldState }) => {
                const fieldValue: PhoneNumber = {
                  number: field.value?.number || "",
                  countryCode: field.value?.countryCode ?? "US",
                };

                return (
                  <PhoneNumberField
                    id="phoneNumber"
                    label="Phone number"
                    value={fieldValue}
                    onChange={field.onChange}
                    error={fieldState.error?.message ?? null}
                    groupClassName="w-full"
                  />
                );
              }}
            />
            {isDirty && (
              <Button size="sm" onClick={handleSave} isLoading={saving} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
        </div>

        {wallets.length > 0 && (
          <section className="mb-8">
            <h2 className="text-foreground mb-3 text-sm font-medium">Connected Wallets</h2>
            <div className="border-border divide-border divide-y rounded-xl border">
              {wallets.map((wallet) => (
                <WalletRow
                  key={wallet.id}
                  wallet={wallet}
                  isLinkedToActiveSubscription={activeWalletIds.has(wallet.id)}
                  isDeleting={isDeletingWallet}
                  onDelete={() => handleDeleteWallet(wallet)}
                />
              ))}
            </div>
          </section>
        )}

        {!hasActivity && (
          <div className="border-border rounded-xl border py-16 text-center">
            <p className="text-foreground font-medium">No activity yet</p>
            <p className="text-muted-foreground mt-1 text-sm">Subscriptions and payments will appear here.</p>
          </div>
        )}

        {activeSubscriptions.length > 0 && (
          <section className="mb-8">
            <h2 className="text-foreground mb-3 text-sm font-medium">Subscriptions</h2>
            <div className="border-border divide-border divide-y rounded-xl border">
              {activeSubscriptions.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  busy={actionId === sub.id}
                  onCancel={() => handleCancel(sub.id)}
                  onPause={() => handlePause(sub.id)}
                  onResume={() =>
                    makeSubscriptionMutation({
                      path: "resume",
                      subscriptionId: sub.id,
                      successMessage: "Subscription resumed",
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {credits.length > 0 && (
          <section className="mb-8">
            <h2 className="text-foreground mb-3 text-sm font-medium">Usage</h2>
            <div className="border-border divide-border divide-y rounded-xl border">
              {credits.map((c, i) => (
                <CreditMeter key={i} credit={c} />
              ))}
            </div>
          </section>
        )}

        {payments.length > 0 && (
          <section>
            <h2 className="text-foreground mb-3 text-sm font-medium">Invoices</h2>
            <div className="border-border divide-border divide-y rounded-xl border">
              {payments.map((p) => (
                <InvoiceRow key={p.id} payment={p} />
              ))}
            </div>
          </section>
        )}

        <Separator className="my-10" />
        <p className="text-muted-foreground text-center text-xs">Powered by StellarTools</p>
      </div>
    </div>
  );
}

function WalletRow({
  wallet,
  isLinkedToActiveSubscription,
  isDeleting,
  onDelete,
}: {
  wallet: Wallet;
  isLinkedToActiveSubscription: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="space-y-0.5">
        <p className="text-foreground font-mono text-sm">{truncate(wallet.address, { start: 8, end: 8 })}</p>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs">Added {moment(wallet.createdAt).format("MMM D, YYYY")}</p>
          {isLinkedToActiveSubscription && (
            <Badge variant="secondary" className="text-[10px]">
              Active subscription
            </Badge>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive size-8 shrink-0"
        onClick={onDelete}
        disabled={isDeleting || isLinkedToActiveSubscription}
        title={
          isLinkedToActiveSubscription ? "Cannot remove a wallet linked to an active subscription" : "Remove wallet"
        }
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function SubscriptionRow({
  sub,
  busy,
  onCancel,
  onPause,
  onResume,
}: {
  sub: Subscription;
  busy: boolean;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const isPaused = sub.status === "paused";

  return (
    <div className="flex items-start justify-between px-4 py-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-foreground text-sm font-medium">{sub.productName ?? "Product"}</p>
          {sub.cancelAtPeriodEnd ? (
            <Badge variant="outline">Canceling</Badge>
          ) : isPaused ? (
            <Badge variant="secondary">Paused</Badge>
          ) : sub.status === "trialing" ? (
            <Badge variant="secondary">Trial</Badge>
          ) : (
            <Badge>Active</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {sub.cancelAtPeriodEnd
            ? `Cancels ${moment(sub.currentPeriodEnd).format("MMM D, YYYY")}`
            : isPaused
              ? "Paused — no charges until resumed"
              : `Renews ${moment(sub.currentPeriodEnd).format("MMM D, YYYY")}`}
        </p>
        {sub.walletAddress && (
          <p className="text-muted-foreground font-mono text-xs">{truncate(sub.walletAddress, { start: 6, end: 6 })}</p>
        )}
      </div>
      {!sub.cancelAtPeriodEnd && (
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button variant="outline" size="sm" onClick={onResume} disabled={busy}>
              {busy ? "Resuming…" : "Resume"}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onPause} disabled={busy} className="text-muted-foreground">
              {busy ? "Pausing…" : "Pause"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function CreditMeter({ credit }: { credit: Credit }) {
  const total = credit.totalCredits ?? BigInt(0);
  const pct = total > 0 ? Math.min((Number(credit.consumed) / Number(total)) * 100, 100) : 0;
  const unit = credit.productUnit ?? "credits";

  return (
    <div className="space-y-3 px-4 py-4">
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
    <div className="flex items-center justify-between px-4 py-3">
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-medium">
          {formatCurrency(Number(stroopsToXlm(payment.amount)), "XLM")}
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

function PortalSkeleton() {
  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-4">
          <Link
            href={process.env.NEXT_PUBLIC_APP_URL!}
            className="text-foreground flex items-center gap-2.5 font-semibold transition-opacity hover:opacity-80"
          >
            <StellarTools width={28} height={28} className="object-contain" />
            <span>StellarTools</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-10 flex items-center gap-5">
          <Skeleton className="size-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-48 rounded-md" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="mb-8 space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="border-border rounded-xl border">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-16" />
          <div className="border-border rounded-xl border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
