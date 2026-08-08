"use client";

import * as React from "react";

import { postOrganizationAndSecret, retrieveOrganizations, setCurrentOrganization } from "@/actions/organization";
import { StellarToolsIcon } from "@/components/icon";
import ModeToggle from "@/components/mode-toggle";
import { walletStrategyEnum } from "@/constant/schema.client";
import { useAction } from "@/hooks/use-action";
import { useClearStaleCookies } from "@/hooks/use-clear-stale-cookies";
import { capture, identifyOrganization } from "@/lib/posthog";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AppModal,
  Badge,
  Button,
  type FileRejection,
  FileUpload,
  type FileWithPreview,
  type PhoneNumber,
  PhoneNumberField,
  Skeleton,
  TextAreaField,
  TextField,
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  phoneNumberToString,
  toast,
} from "@stellartools/shared-ui";
import { useQuery } from "@tanstack/react-query";
import countryToCurrency from "country-to-currency";
import { getCurrency as getCurrencyFromLocale$AcceptHeaders } from "locale-currency";
import { AlertTriangle, Building2, ChevronRight, KeyRound, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import * as RHF from "react-hook-form";
import { z } from "zod";

interface Client$SelectOrganizationPageProps {
  xVercelIpCountry: string | null;
  acceptLanguage: string | null;
  autoOpen: boolean;
}

export const Client$SelectOrganizationPage = ({
  xVercelIpCountry,
  acceptLanguage,
  autoOpen,
}: Client$SelectOrganizationPageProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  useClearStaleCookies();

  const next = searchParams.get("next");
  const { data: organizations, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => retrieveOrganizations(),
  });

  const hasOrganizations = !!(organizations && organizations.length > 0);
  const createModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [createModalFooterProps, setCreateModalFooterProps] = React.useState({ isPending: false });
  const isCreateModalOpenRef = React.useRef(false);

  const [isNavigating, startNavigating] = React.useTransition();

  const openCreateModal = React.useCallback(() => {
    isCreateModalOpenRef.current = true;
    setCreateModalFooterProps({ isPending: false });
    AppModal.open({
      title: "Create Organization",
      description: "Set up your workspace to get started",
      content: (
        <CreateOrganizationModalContent
          setSubmitRef={createModalSubmitRef}
          onFooterChange={setCreateModalFooterProps}
          xVercelIpCountry={xVercelIpCountry}
          acceptLanguage={acceptLanguage}
          onSuccess={async (orgId) => {
            await setCurrentOrganization(orgId);
            startNavigating(() => {
              router.push(next ?? "/");
            });
          }}
        />
      ),
      footer: (
        <CreateOrganizationModalFooter
          hasOrganizations={hasOrganizations}
          onClose={AppModal.close}
          submitRef={createModalSubmitRef}
          isPending={createModalFooterProps.isPending || isNavigating}
        />
      ),
      size: "full",
      showCloseButton: hasOrganizations,
      onClose: () => {
        isCreateModalOpenRef.current = false;
      },
    });
  }, [
    hasOrganizations,
    router,
    next,
    xVercelIpCountry,
    acceptLanguage,
    createModalFooterProps.isPending,
    isNavigating,
  ]);

  React.useEffect(() => {
    if (isCreateModalOpenRef.current) {
      AppModal.updateConfig({
        footer: (
          <CreateOrganizationModalFooter
            hasOrganizations={hasOrganizations}
            onClose={AppModal.close}
            submitRef={createModalSubmitRef}
            isPending={createModalFooterProps.isPending || isNavigating}
          />
        ),
      });
    }
  }, [createModalFooterProps.isPending, hasOrganizations, isNavigating]);

  React.useEffect(() => {
    if (autoOpen) openCreateModal();
  }, [autoOpen]);

  const handleSelectOrg = React.useCallback(
    async (orgId: string, orgName: string) => {
      capture("organization_selected", { org_id: orgId, org_name: orgName });
      await setCurrentOrganization(orgId);
      startNavigating(() => {
        router.push(next ?? "/");
      });
    },
    [router, next]
  );

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-foreground/5 border-border flex size-12 items-center justify-center rounded-2xl border">
            <StellarToolsIcon width={26} height={26} className="text-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-foreground text-xl font-semibold tracking-tight">
              {hasOrganizations ? "Switch workspace" : "Get started"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {hasOrganizations ? "Choose an organization to continue" : "Create your first organization to begin"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {organizations?.map((org) => (
            <button
              key={org.id}
              className="border-border hover:bg-accent group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border bg-transparent px-4 py-3.5 text-left transition-all duration-150 hover:shadow-sm"
              onClick={() => handleSelectOrg(org.id, org.name)}
            >
              <div className="border-border flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                {org.logoUrl ? (
                  <Image src={org.logoUrl} alt={org.name} width={40} height={40} className="size-full object-cover" />
                ) : (
                  <Building2 className="text-muted-foreground size-4.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">{org.name}</p>
                <p className="text-muted-foreground text-xs">Your organization</p>
              </div>
              <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}

          <button
            className="border-border hover:bg-accent group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-dashed bg-transparent px-4 py-3.5 text-left transition-all duration-150"
            onClick={() => openCreateModal()}
          >
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Plus className="text-muted-foreground size-4" />
            </div>
            <div className="flex-1">
              <p className="text-foreground text-sm font-medium">New organization</p>
              <p className="text-muted-foreground text-xs">Start a fresh workspace</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
    <div className="w-full max-w-sm space-y-8">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-5 w-36" />
          <Skeleton className="mx-auto h-4 w-52" />
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-border flex items-center gap-3.5 rounded-xl border px-4 py-3.5">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// -- CREATE ORGANIZATION  --

function CreateOrganizationModalFooter({
  hasOrganizations,
  onClose,
  submitRef,
  isPending,
}: {
  hasOrganizations: boolean;
  onClose: () => void;
  submitRef: React.RefObject<(() => void) | null>;
  isPending: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <ModeToggle />
      <div className="flex gap-3">
        {hasOrganizations && (
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={() => submitRef.current?.()} disabled={isPending} isLoading={isPending}>
          {isPending ? "Creating..." : "Create Organization"}
        </Button>
      </div>
    </div>
  );
}

// Picking a country from the dropdown alone (no digits typed) still produces a
// present-but-empty object — plain `phoneNumberSchema.optional()` would validate
// that object against its `min(1)` and wrongly report "Phone number is required".
const optionalPhoneNumberSchema = z
  .object({ number: z.string(), countryCode: z.string().default("US") })
  .optional()
  .nullable();

const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;
const STELLAR_SECRET_KEY_REGEX = /^S[A-Z2-7]{55}$/;

const createOrganizationSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    phoneNumber: optionalPhoneNumberSchema,
    description: z.string().optional(),
    physicalAddress: z.string().optional(),
    supportEmail: z.email(),
    walletStrategy: z.enum(walletStrategyEnum).default("managed"),
    externalPublicKey: z
      .string()
      .optional()
      .refine((val) => val === "" || val === undefined || STELLAR_PUBLIC_KEY_REGEX.test(val), {
        message: "Enter a valid Stellar public key (starts with G, 56 characters)",
        path: ["externalPublicKey"],
      }),
    externalSecretKey: z
      .string()
      .optional()
      .refine((val) => !val || STELLAR_SECRET_KEY_REGEX.test(val), {
        message: "Enter a valid Stellar secret key (starts with S, 56 characters)",
      }),
    logo: z
      .custom<FileWithPreview[]>((val) => {
        if (!Array.isArray(val)) return false;
        return val.every((item) => item instanceof File);
      })
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.walletStrategy === "direct") {
        return STELLAR_PUBLIC_KEY_REGEX.test(data.externalPublicKey ?? "");
      }
      return true;
    },
    { message: "Enter a valid Stellar public key (starts with G, 56 characters)", path: ["externalPublicKey"] }
  )
  .refine(
    (data) => {
      if (data.walletStrategy === "direct" && data.externalSecretKey) {
        return STELLAR_SECRET_KEY_REGEX.test(data.externalSecretKey);
      }
      return true;
    },
    { message: "Enter a valid Stellar secret key (starts with S, 56 characters)", path: ["externalSecretKey"] }
  );

type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>;

const CreateOrganizationModalContent = ({
  setSubmitRef,
  onFooterChange,
  xVercelIpCountry,
  acceptLanguage,
  onSuccess,
}: {
  setSubmitRef: React.MutableRefObject<(() => void) | null>;
  onFooterChange: (props: { isPending: boolean }) => void;
  xVercelIpCountry: string | null;
  acceptLanguage: string | null;
  onSuccess: (orgId: string) => void;
}) => {
  const form = RHF.useForm({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      phoneNumber: undefined,
      description: "",
      physicalAddress: "",
      supportEmail: "",
      walletStrategy: "managed" as const,
      externalPublicKey: "",
      externalSecretKey: "",
      logo: null,
    },
  });

  const fieldOrder = ["name", "description", "phoneNumber", "supportEmail", "physicalAddress"] as const;

  const { mutate: createOrganization, isPending: isCreatingOrganization } = useAction(
    async (data: CreateOrganizationFormData) => {
      const defaultEnvironment = "testnet" as const;
      const formData = new FormData();
      if (data.logo?.[0]) formData.append("logo", data.logo[0]);

      let selectedCurrency = null;

      if (data.phoneNumber?.countryCode) {
        selectedCurrency =
          countryToCurrency[data.phoneNumber.countryCode.toUpperCase() as keyof typeof countryToCurrency];
      } else if (xVercelIpCountry) {
        selectedCurrency = countryToCurrency[xVercelIpCountry.toUpperCase() as keyof typeof countryToCurrency];
      } else if (acceptLanguage) {
        selectedCurrency = getCurrencyFromLocale$AcceptHeaders(
          acceptLanguage.split(",")[0]?.split(";")[0]?.trim() ?? ""
        );
      }

      return await postOrganizationAndSecret(
        {
          name: data.name,
          phoneNumber: data.phoneNumber?.number ? phoneNumberToString(data.phoneNumber) : null,
          description: data.description ?? null,
          logoUrl: null,
          settings: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: null,
          address: null,
          socialLinks: null,
          supportEmail: null,
          selectedCurrency: selectedCurrency ?? "USD",
          walletStrategy: data.walletStrategy,
        },
        defaultEnvironment,
        {
          formDataWithFiles: formData,
          externalPublicKey: data.externalPublicKey,
          externalSecretKey: data.externalSecretKey || null,
        }
      );
    },
    {
      onSuccess: (org) => {
        if (org.success && "id" in org) {
          const orgName = form.getValues("name");
          identifyOrganization(org.id, { name: orgName, environment: "testnet", createdAt: new Date().toISOString() });
          capture("organization_created", { org_id: org.id, org_name: orgName, environment: "testnet" });
          onSuccess(org.id);
        } else if (!org.success && "error" in org) {
          toast.error(org.error as string);
        }
      },
      errorMsg: "Failed to create organization",
    }
  );

  const handleLogoRejected = (rejections: FileRejection[]) => {
    const firstError = rejections[0]?.errors[0];
    if (firstError) {
      toast.error(firstError.message || "Failed to upload logo");
    }
  };

  const handleSubmit = form.handleSubmit((data) => createOrganization(data));
  const submitForm = React.useCallback(async () => {
    const isValid = await form.trigger();
    if (isValid) handleSubmit();
  }, [form, handleSubmit]);

  React.useEffect(() => {
    setSubmitRef.current = submitForm;
    return () => {
      setSubmitRef.current = null;
    };
  }, [setSubmitRef, submitForm]);

  React.useEffect(() => {
    onFooterChange({ isPending: isCreatingOrganization });
  }, [isCreatingOrganization, onFooterChange]);

  const focusNext = (current: (typeof fieldOrder)[number]) => {
    const next = fieldOrder[fieldOrder.indexOf(current) + 1];
    if (next) form.setFocus(next);
    else void submitForm();
  };

  const onEnter = (field: (typeof fieldOrder)[number]) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    focusNext(field);
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={form.handleSubmit((data) => createOrganization(data))}
        className="grid h-full w-full gap-8 lg:grid-cols-2"
        noValidate
      >
        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-lg font-semibold">Basic Information</h3>
            <div className="space-y-5">
              <RHF.Controller
                control={form.control}
                name="logo"
                render={({ field, fieldState: { error } }) => (
                  <FileUpload
                    label="Organization Logo"
                    id="organization-logo"
                    value={field.value ?? []}
                    onFilesChange={(files) => {
                      field.onChange(files);
                    }}
                    onFilesRejected={handleLogoRejected}
                    placeholder="Drag & drop your logo here, or click to select"
                    description="PNG, JPG up to 5MB"
                    disabled={isCreatingOrganization}
                    dropzoneAccept={{
                      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
                    }}
                    dropzoneMaxSize={5 * 1024 * 1024}
                    dropzoneMultiple={false}
                    enableTransformation
                    targetFormat="image/png"
                    error={error?.message}
                    maxDimension={1024}
                  />
                )}
              />

              <RHF.Controller
                control={form.control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    ref={field.ref}
                    id="organization-name"
                    label="Organization Name"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Acme Inc."
                    error={error?.message}
                    labelClassName="text-sm font-medium"
                    required
                    className="w-full shadow-none"
                    onKeyDown={onEnter("name")}
                  />
                )}
              />

              <RHF.Controller
                control={form.control}
                name="description"
                render={({ field, fieldState: { error } }) => (
                  <TextAreaField
                    ref={field.ref}
                    id={field.name}
                    label="Description"
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Tell us about your organization..."
                    error={error?.message}
                    className="w-full shadow-none"
                    rows={6}
                    onKeyDown={onEnter("description")}
                  />
                )}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-lg font-semibold">Contact Details</h3>
            <div className="space-y-5">
              <RHF.Controller
                control={form.control}
                name="phoneNumber"
                render={({ field, fieldState: { error } }) => {
                  const phoneValue: PhoneNumber = {
                    number: field.value?.number || "",
                    countryCode: field.value?.countryCode || "US",
                  };

                  return (
                    <PhoneNumberField
                      ref={field.ref}
                      id={field.name}
                      label="Phone Number"
                      value={phoneValue}
                      onChange={field.onChange}
                      error={(error as any)?.number?.message}
                      disabled={isCreatingOrganization}
                      groupClassName="w-full shadow-none"
                      inputOnKeyDown={onEnter("phoneNumber")}
                    />
                  );
                }}
              />

              <RHF.Controller
                control={form.control}
                name="supportEmail"
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    ref={field.ref}
                    id={field.name}
                    label="Support Email"
                    type="email"
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="support@example.com"
                    error={error?.message}
                    className="w-full shadow-none"
                    onKeyDown={onEnter("supportEmail")}
                  />
                )}
              />

              <RHF.Controller
                control={form.control}
                name="physicalAddress"
                render={({ field, fieldState: { error } }) => (
                  <TextAreaField
                    ref={field.ref}
                    id={field.name}
                    label="Physical Address"
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="123 Main St, City, State, ZIP"
                    error={error?.message}
                    className="w-full shadow-none"
                    rows={3}
                    onKeyDown={onEnter("physicalAddress")}
                  />
                )}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-lg font-semibold">Wallet Configuration</h3>
            <p className="text-muted-foreground mb-4 text-xs">
              Choose how payments are received into your organization.
            </p>

            <RHF.Controller
              control={form.control}
              name="walletStrategy"
              render={({ field }) => (
                <UnderlineTabs value={field.value} onValueChange={field.onChange}>
                  <UnderlineTabsList>
                    <UnderlineTabsTrigger value="managed" className="cursor-pointer">
                      <span className="flex items-center gap-1.5">
                        Managed
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                        >
                          Recommended
                        </Badge>
                      </span>
                    </UnderlineTabsTrigger>
                    <UnderlineTabsTrigger value="direct" className="cursor-pointer">
                      Self-Custody
                    </UnderlineTabsTrigger>
                  </UnderlineTabsList>

                  <UnderlineTabsContent value="managed" className="mt-4">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      StellarTools generates and holds a secure vault for your organization. Refunds, trustlines, and
                      subscription management are all handled automatically on your behalf.
                    </p>
                  </UnderlineTabsContent>

                  <UnderlineTabsContent value="direct" className="mt-4 space-y-4">
                    <RHF.Controller
                      control={form.control}
                      name="externalPublicKey"
                      render={({ field: pkField, fieldState: { error } }) => (
                        <TextField
                          ref={pkField.ref}
                          id="external-public-key"
                          label="Your Stellar Public Key"
                          value={pkField.value || ""}
                          onChange={pkField.onChange}
                          placeholder="GABC…XYZ"
                          error={error?.message}
                          className="w-full font-mono shadow-none"
                          required
                        />
                      )}
                    />

                    <div className="space-y-3">
                      <RHF.Controller
                        control={form.control}
                        name="externalSecretKey"
                        render={({ field: skField, fieldState: { error } }) => (
                          <TextField
                            ref={skField.ref}
                            id="external-secret-key"
                            label="Secret Key (Optional)"
                            helpText="Storing your secret key enables subscriptions, automated refunds, subscription management, and payouts"
                            value={skField.value || ""}
                            onChange={skField.onChange}
                            type="password"
                            placeholder="SABC…XYZ"
                            error={error?.message}
                            className="w-full font-mono shadow-none"
                          />
                        )}
                      />
                    </div>

                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
                      <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-500" />
                      <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                        Without a secret key, subscriptions, refunds, subscription management, and payouts are
                        unavailable.
                      </p>
                    </div>
                  </UnderlineTabsContent>
                </UnderlineTabs>
              )}
            />
          </div>
        </div>
      </form>
    </div>
  );
};
