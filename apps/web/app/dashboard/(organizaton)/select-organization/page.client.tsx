"use client";

import * as React from "react";

import { postOrganizationAndSecret, retrieveOrganizations, setCurrentOrganization } from "@/actions/organization";
import { StellarTools } from "@/components/icon";
import { useAction } from "@/hooks/use-action";
import { capture, identifyOrganization } from "@/lib/posthog";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AppModal,
  Button,
  FileUpload,
  type FileWithPreview,
  type PhoneNumber,
  PhoneNumberField,
  Skeleton,
  TextAreaField,
  TextField,
  phoneNumberSchema,
  phoneNumberToString,
  toast,
} from "@stellartools/shared-ui";
import { useQuery } from "@tanstack/react-query";
import countryToCurrency from "country-to-currency";
import { getCurrency as getCurrencyFromLocale$AcceptHeaders } from "locale-currency";
import { Building2, ChevronRight, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { FileRejection } from "react-dropzone";
import * as RHF from "react-hook-form";
import { z } from "zod";

interface Client$SelectOrganizationPageProps {
  xVercelIpCountry: string | null;
  acceptLanguage: string | null;
}

export const Client$SelectOrganizationPage = ({
  xVercelIpCountry,
  acceptLanguage,
}: Client$SelectOrganizationPageProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { data: organizations, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => retrieveOrganizations(),
  });

  const hasOrganizations = !!(organizations && organizations.length > 0);
  const createModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [createModalFooterProps, setCreateModalFooterProps] = React.useState({ isPending: false });
  const isCreateModalOpenRef = React.useRef(false);

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
            AppModal.close();
            await setCurrentOrganization(orgId);
            router.push(next ?? "/");
          }}
        />
      ),
      footer: (
        <CreateOrganizationModalFooter
          hasOrganizations={hasOrganizations}
          onClose={AppModal.close}
          submitRef={createModalSubmitRef}
          isPending={createModalFooterProps.isPending}
        />
      ),
      size: "full",
      showCloseButton: hasOrganizations,
      onClose: () => {
        isCreateModalOpenRef.current = false;
      },
    });
  }, [hasOrganizations, router, xVercelIpCountry, acceptLanguage]);

  React.useEffect(() => {
    if (isCreateModalOpenRef.current) {
      AppModal.updateConfig({
        footer: (
          <CreateOrganizationModalFooter
            hasOrganizations={hasOrganizations}
            onClose={AppModal.close}
            submitRef={createModalSubmitRef}
            isPending={createModalFooterProps.isPending}
          />
        ),
      });
    }
  }, [createModalFooterProps.isPending, hasOrganizations]);

  React.useEffect(() => {
    if (searchParams?.get("create") === "true") openCreateModal();
  }, [searchParams?.get("create"), openCreateModal]);

  const handleSelectOrg = React.useCallback(
    async (orgId: string, orgName: string) => {
      capture("organization_selected", { org_id: orgId, org_name: orgName });
      await setCurrentOrganization(orgId);
      router.push(next ?? "/");
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
            <StellarTools width={26} height={26} className="text-foreground" />
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
            onClick={openCreateModal}
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
    <div className="flex w-full justify-end gap-3">
      {hasOrganizations && (
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
      )}
      <Button
        type="button"
        onClick={() => submitRef.current?.()}
        disabled={isPending}
        isLoading={isPending}
        className="gap-2"
      >
        {isPending ? "Creating..." : "Create Organization"}
      </Button>
    </div>
  );
}

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: phoneNumberSchema.optional().nullable(),
  description: z.string().optional(),
  physicalAddress: z.string().optional(),
  supportEmail: z.email(),
  logo: z
    .custom<FileWithPreview[]>((val) => {
      if (!Array.isArray(val)) return false;
      return val.every((item) => item instanceof File);
    })
    .nullable(),
});

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
      phoneNumber: { number: "", countryCode: "US" },
      description: "",
      physicalAddress: "",
      supportEmail: "",
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

      console.log({ selectedCurrency });

      return await postOrganizationAndSecret(
        {
          name: data.name,
          phoneNumber: data.phoneNumber ? phoneNumberToString(data.phoneNumber) : null,
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
          payoutAssetCode: null,
          payoutAssetIssuer: null,
          payoutFiatOptions: null,
        },
        defaultEnvironment,
        { formDataWithFiles: formData }
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
        </div>
      </form>
    </div>
  );
};
