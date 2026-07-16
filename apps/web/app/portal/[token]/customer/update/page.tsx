"use client";

import * as React from "react";

import { createCustomerImage, getCustomerPortalData } from "@/actions/customers";
import { StellarTools } from "@/components/icon";
import { ModeToggle } from "@/components/mode-toggle";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import {
  Button,
  FileUpload,
  type FileWithPreview,
  PhoneNumber,
  PhoneNumberField,
  Skeleton,
  TextField,
  phoneNumberFromString,
  phoneNumberSchema,
  phoneNumberToString,
  toast,
  useFilePreview,
} from "@stellartools/shared-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as RHF from "react-hook-form";
import { z as Schema } from "zod";

const portalFormSchema = Schema.object({
  name: Schema.string().optional().nullable(),
  email: Schema.email().optional().nullable(),
  phoneNumber: phoneNumberSchema,
  image: Schema.custom<FileWithPreview>((val) => val instanceof File)
    .optional()
    .nullable(),
});

type PortalData = Awaited<ReturnType<typeof getCustomerPortalData>>;
type Organization = NonNullable<PortalData>["organization"];

export default function CustomerUpdatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params);
  const router = useRouter();
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
    },
  });

  const [saving, startSave] = React.useTransition();

  const handleSave = form.handleSubmit((formData) => {
    startSave(async () => {
      let imageUrl: string | null = null;

      if (formData.image instanceof File) {
        const fd = new FormData();
        fd.append("image", formData.image);
        imageUrl = (await createCustomerImage(fd)) ?? null;
      }

      const phone =
        formData.phoneNumber.number.replace(/\D/g, "").length >= 10 ? phoneNumberToString(formData.phoneNumber) : "";

      const api = new ApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL!, headers: {} });
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

      toast.success("Information updated");
      queryClient.invalidateQueries({ queryKey: ["customer-portal", token] });
      router.push(`/${token}`);
    });
  });

  const image = form.watch("image");

  if (isLoading) return <PageSkeleton />;

  if (!data?.customer) return null;

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
            <span className="text-foreground">Billing information</span>
          </nav>

          <h1 className="text-foreground mb-8 text-2xl font-semibold">Billing information</h1>

          <div className="space-y-6">
            <div className="flex justify-start">
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
                  className="w-full"
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
                  className="w-full"
                />
              )}
            />

            <RHF.Controller
              control={form.control}
              name="phoneNumber"
              render={({ field, fieldState }) => (
                <PhoneNumberField
                  id="phoneNumber"
                  label="Phone number"
                  value={(field.value as PhoneNumber) ?? { number: "", countryCode: "US" }}
                  onChange={field.onChange}
                  error={fieldState.error?.message ?? null}
                  groupClassName="w-full"
                />
              )}
            />

            <div className="flex flex-col gap-3 pt-2">
              <Button onClick={handleSave} isLoading={saving} disabled={saving} className="w-full">
                Save
              </Button>
              <Button variant="outline" className="w-full" disabled={saving} onClick={() => router.push(`/${token}`)}>
                Cancel
              </Button>
            </div>
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
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-12">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="size-20 rounded-full" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}
