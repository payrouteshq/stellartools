"use client";

import * as React from "react";

import { postOrganizationAndSecret, retrieveOrganizations, setCurrentOrganization } from "@/actions/organization";
import { AppModal } from "@/components/app-modal";
import { FileUpload, type FileWithPreview } from "@/components/file-upload";
import {
  type PhoneNumber,
  PhoneNumberField,
  phoneNumberSchema,
  phoneNumberToString,
} from "@/components/phone-number-field";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { capture, identifyOrganization } from "@/lib/posthog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { FileRejection } from "react-dropzone";
import * as RHF from "react-hook-form";
import { useHotkeys } from "react-hotkeys-hook";
import { z } from "zod";


export default function SelectOrganizationPage() {
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
          hasOrganizations={hasOrganizations}
          onClose={AppModal.close}
          onSuccess={() => {
            AppModal.close();
            router.push("/");
          }}
          setSubmitRef={createModalSubmitRef}
          onFooterChange={setCreateModalFooterProps}
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
  }, [hasOrganizations, router]);

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
    <>
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Select Organization</h1>
            <p className="text-muted-foreground mt-2">Choose an organization to continue</p>
          </div>

          <div className="space-y-4">
            {organizations?.map((org) => (
              <div
                key={org.id}
                className="hover:bg-accent/50 group flex cursor-pointer items-center gap-4 rounded-lg p-4 transition-all"
                onClick={() => handleSelectOrg(org.id, org.name)}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                  {org.logoUrl ? (
                    <Image
                      src={org.logoUrl}
                      alt={org.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <Building2 className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <b className="font-semibold">{org.name}</b>
                  <p className="text-muted-foreground mt-1 text-sm">Your organization</p>
                </div>
                <ChevronRight className="text-muted-foreground h-5 w-5" />
              </div>
            ))}

            <div
              className="hover:bg-accent/50 group flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-all"
              onClick={openCreateModal}
            >
              <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                <Plus className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Create New Organization</h3>
                <p className="text-muted-foreground text-sm">Start a new workspace</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const LoadingSkeleton = () => {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Select Organization</h1>
          <p className="text-muted-foreground mt-2">Choose an organization to continue</p>
        </div>

        <div className="w-full space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="mb-2 h-5 w-40" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
  phoneNumber: phoneNumberSchema,
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
  hasOrganizations,
  onClose,
  onSuccess,
  setSubmitRef,
  onFooterChange,
}: {
  hasOrganizations: boolean;
  onClose: () => void;
  onSuccess: () => void;
  setSubmitRef: React.MutableRefObject<(() => void) | null>;
  onFooterChange: (props: { isPending: boolean }) => void;
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


  const createOrgMutation = useMutation({
    mutationFn: async (data: CreateOrganizationFormData) => {
      const defaultEnvironment = "testnet" as const;
      const formData = new FormData();

      if (data.logo?.[0]) formData.append("logo", data.logo[0]);

      return await postOrganizationAndSecret(
        {
          name: data.name,
          phoneNumber: phoneNumberToString(data.phoneNumber),
          description: data.description ?? null,
          logoUrl: null,
          settings: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: null,
          address: null,
          socialLinks: null,
          supportEmail: null,
        },
        defaultEnvironment,
        { formDataWithFiles: formData }
      );
    },
    onSuccess: async (org) => {
      if (org.success && "id" in org) {
        const orgName = form.getValues("name");
        identifyOrganization(org.id, { name: orgName, environment: "testnet", createdAt: new Date().toISOString() });
        capture("organization_created", { org_id: org.id, org_name: orgName, environment: "testnet" });
        toast.success("Organization created successfully");
        await setCurrentOrganization(org.id);
        form.reset();
        onSuccess();
      } else if (!org.success && "error" in org) {
        toast.error(org.error as string);
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to create organization");
    },
  });

  const handleLogoRejected = (rejections: FileRejection[]) => {
    const firstError = rejections[0]?.errors[0];
    if (firstError) {
      toast.error(firstError.message || "Failed to upload logo");
    }
  };

  const handleSubmit = form.handleSubmit((data) => createOrgMutation.mutateAsync(data));
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
    onFooterChange({ isPending: createOrgMutation.isPending });
  }, [createOrgMutation.isPending, onFooterChange]);

  const focusNext = (current: (typeof fieldOrder)[number]) => {
    const next = fieldOrder[fieldOrder.indexOf(current) + 1];
    if (next) form.setFocus(next);
    else void submitForm();
  };

  const onEnter =
    (field: (typeof fieldOrder)[number]) => (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
      e.preventDefault();
      focusNext(field);
    };


  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={form.handleSubmit((data) => createOrgMutation.mutateAsync(data))}
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
                    disabled={createOrgMutation.isPending}
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
                      disabled={createOrgMutation.isPending}
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
