"use client";

import * as React from "react";

import { initiate2faReset, setup2fa, toggle2fa } from "@/actions/2fa";
import { putAccount } from "@/actions/account";
import { getCurrentUser } from "@/actions/auth";
import { putOrganization, retrieveOrganization } from "@/actions/organization";
import { AppModal } from "@/components/app-modal";
import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { FileUpload, type FileWithPreview } from "@/components/file-upload";
import {
  PhoneNumber,
  PhoneNumberField,
  phoneNumberFromString,
  phoneNumberSchema,
} from "@/components/phone-number-field";
import { Spinner } from "@/components/spinner";
import { TextAreaField, TextField } from "@/components/text-field";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@/components/underline-tabs";
import { useAction } from "@/hooks/use-action";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useCopy } from "@/hooks/use-copy";
import { useCurrencyConverter } from "@/hooks/use-currency-converter";
import { useFilePreview } from "@/hooks/use-file-preview";
import { useOrgContext } from "@/hooks/use-org-query";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import moment from "moment";
import Link from "next/link";
import * as RHF from "react-hook-form";
import { z as Schema } from "zod";

const profileSchema = Schema.object({
  name: Schema.string().min(1, "Name is required").trim(),
  avatar: Schema.custom<FileWithPreview>((val) => val instanceof File).nullable(),
});

type ProfileFormData = Schema.infer<typeof profileSchema>;

const organizationSchema = Schema.object({
  id: Schema.string(),
  name: Schema.string().min(1, "Name is required").trim(),
  phoneNumber: phoneNumberSchema.optional().nullable(),
  description: Schema.string().optional(),
  logo: Schema.custom<FileWithPreview>((val) => val instanceof File).nullable(),
});

type OrganizationFormData = Schema.infer<typeof organizationSchema>;

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type Organization = Awaited<ReturnType<typeof retrieveOrganization>>;

const ProfileTabContent = ({ user }: { user: User }) => {
  const { file, isLoading: imgLoading } = useFilePreview(user.profile?.avatarUrl);

  const profileForm = RHF.useForm({
    resolver: zodResolver(profileSchema),
    values: { name: `${user.profile?.firstName ?? ""} ${user.profile?.lastName ?? ""}`.trim(), avatar: file },
  });

  const { mutate: updateProfile, isPending: isSubmitting } = useAction(
    async (data: ProfileFormData) => {
      const formdata = new FormData();

      const file = data.avatar;

      if (file instanceof File) formdata.set("avatar", file);

      await putAccount(
        user.id,
        {
          profile: {
            firstName: data.name.split(" ")[0] ?? undefined,
            lastName: data.name.split(" ").slice(1).join(" ") ?? undefined,
          },
        },
        { formDataWithFiles: formdata }
      );

      return true;
    },
    { successMsg: "Profile updated successfully", invalidate: ["current-user"], errorMsg: "Failed to update profile" }
  );

  const avatar = profileForm.watch("avatar");

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <FileUpload
              label={null}
              value={avatar ? [avatar] : undefined}
              onFilesChange={(files) => profileForm.setValue("avatar", files[0])}
              disabled={isSubmitting}
              dropzoneAccept={{ "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] }}
              dropzoneMaxSize={5 * 1024 * 1024}
              dropzoneMultiple={false}
              isLoading={imgLoading}
              enableTransformation
              targetFormat="image/png"
              error={profileForm.formState.errors.avatar?.message}
              placeholder=""
              description=""
              shape="circle"
              className="w-fit"
            />

            <div className="flex-1 space-y-2">
              <CardTitle className="text-xl">Profile Information</CardTitle>
              {user.createdAt && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {moment(user.createdAt).format("MMM D, YYYY")}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit((data) => updateProfile(data))} className="space-y-6">
            <RHF.Controller
              control={profileForm.control}
              name="name"
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  id="full-name"
                  label="Full Name"
                  error={error?.message || null}
                  className="w-full shadow-none"
                />
              )}
            />

            <div className="space-y-2">
              <TextField
                id="email"
                label="Email Address"
                value={user.email}
                onChange={() => {}}
                disabled
                error={null}
                className="w-full pr-10 shadow-none"
              />
              <p className="text-muted-foreground text-xs">
                Email cannot be changed for security reasons. Contact support if needed.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="gap-2 shadow-none">
                {isSubmitting ? (
                  <>
                    <Spinner strokeColor="text-primary" size={25} />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
};

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

const CurrencyPickerCard = () => {
  const { data: orgContext } = useOrgContext();
  const [open, setOpen] = React.useState(false);

  const { fiatRates, isLoading } = useCurrencyConverter();

  const currencyItems = React.useMemo(() => {
    if (!fiatRates) return [];
    return Object.keys(fiatRates)
      .map((code) => ({ code, name: currencyNames.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fiatRates]);

  const { mutate: updateCurrency, isPending } = useAction(
    async (code: string) => {
      if (!orgContext?.id) return;
      await putOrganization(orgContext.id, { selectedCurrency: code });
    },
    { invalidate: ["*"], successMsg: "Currency updated", errorMsg: "Failed to update currency" }
  );

  const selected = currencyItems.find((c) => c.code === orgContext?.selectedCurrency) ?? null;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Display Currency</CardTitle>
        <CardDescription>
          This is the currency used across your dashboard and shown to customers at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {isLoading ? (
              <div className="flex h-9 w-full max-w-xs items-center">
                <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
              </div>
            ) : (
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="h-9 w-full max-w-xs justify-between rounded-lg font-normal shadow-none"
              >
                <span className="truncate">{selected ? `${selected.name} (${selected.code})` : "Select currency"}</span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
            <Command>
              <CommandInput placeholder="Search currency..." />
              <CommandList className="max-h-[280px]">
                <CommandEmpty>No currency found.</CommandEmpty>
                <CommandGroup>
                  {currencyItems.map((item) => (
                    <CommandItem
                      key={item.code}
                      value={`${item.name} ${item.code}`.toLowerCase()}
                      disabled={isPending}
                      onSelect={() => {
                        updateCurrency(item.code);
                        setOpen(false);
                      }}
                    >
                      <span
                        className={cn("flex-1 truncate", orgContext?.selectedCurrency === item.code && "font-medium")}
                      >
                        {item.name} ({item.code})
                      </span>
                      {orgContext?.selectedCurrency === item.code && <Check className="size-4 shrink-0" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
};

const OrganizationTabContent = ({ organization }: { organization: Organization }) => {
  const { data: orgContext } = useOrgContext();

  const { file, isLoading: imgLoading } = useFilePreview(organization.logoUrl);

  const organizationForm = RHF.useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      id: organization.id,
      name: organization.name,
      description: organization.description ?? "",
      logo: undefined,
      phoneNumber: organization.phoneNumber ? phoneNumberFromString(organization.phoneNumber) : undefined,
    },
    values: {
      id: organization.id,
      name: organization.name,
      description: organization.description ?? "",
      logo: file,
      phoneNumber: organization.phoneNumber ? phoneNumberFromString(organization.phoneNumber) : undefined,
    },
  });

  const { mutate: updateOrganization, isPending: isSubmitting } = useAction(
    async (data: OrganizationFormData) => {
      if (!orgContext?.id) return;
      const formData = new FormData();
      if (data.logo instanceof File) formData.set("logo", data.logo);
      await putOrganization(
        orgContext.id,
        { name: data.name, description: data.description || null },
        { formDataWithFiles: formData }
      );
      return true;
    },
    {
      invalidate: [
        ["organization", orgContext?.id ? orgContext.id : undefined],
        ["sidebar-organizations"],
        ["org-context"],
      ],
      successMsg: "Organization settings updated successfully",
      errorMsg: "Failed to update organization settings",
    }
  );

  const logo = organizationForm.watch("logo");

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <FileUpload
              label={null}
              value={logo ? [logo] : undefined}
              onFilesChange={(files) => organizationForm.setValue("logo", files[0])}
              disabled={isSubmitting}
              dropzoneAccept={{ "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] }}
              dropzoneMaxSize={5 * 1024 * 1024}
              dropzoneMultiple={false}
              enableTransformation
              targetFormat="image/png"
              shape="circle"
              className="w-fit"
              isLoading={imgLoading}
            />

            <div className="flex-1 space-y-2">
              <CardTitle className="text-xl">Organization Information</CardTitle>
              <CardDescription className="mt-1">Update your organization details and branding.</CardDescription>
              {organization.createdAt && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Created {moment(organization.createdAt).format("MMM D, YYYY")}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Update your organization name and description</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={organizationForm.handleSubmit((data) => updateOrganization(data))} className="space-y-6">
            <RHF.Controller
              control={organizationForm.control}
              name="name"
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  id="organization-name"
                  label="Organization Name"
                  error={error?.message || null}
                  className="w-full shadow-none"
                />
              )}
            />

            <RHF.Controller
              control={organizationForm.control}
              name="phoneNumber"
              render={({ field, fieldState: { error } }) => (
                <PhoneNumberField
                  id="phone-number"
                  label="Phone Number"
                  value={field.value as PhoneNumber}
                  onChange={field.onChange}
                  error={error?.message || null}
                  disabled={isSubmitting}
                  groupClassName="w-full shadow-none"
                />
              )}
            />

            <RHF.Controller
              name="id"
              control={organizationForm.control}
              render={({ field, fieldState: { error } }) => (
                <TextField {...field} label="Organization ID" error={error?.message} id={field.name} disabled />
              )}
            />

            <RHF.Controller
              control={organizationForm.control}
              name="description"
              render={({ field, fieldState: { error } }) => (
                <TextAreaField
                  {...field}
                  value={field.value || ""}
                  id="organization-description"
                  label="Description"
                  placeholder="Tell us about your organization..."
                  error={error?.message || null}
                  className="w-full shadow-none"
                />
              )}
            />

            <div className="flex justify-end">
              <Button isLoading={isSubmitting} type="submit" disabled={isSubmitting} className="gap-2 shadow-none">
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <CurrencyPickerCard />
    </>
  );
};

const codeSchema = Schema.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers");

const $2faSchema = Schema.object({
  code: codeSchema,
});

const $2faModal = ({
  userId,
  setupData,
  userEmail,
}: {
  userId: string;
  setupData?: { secret: string; qrCodeDataUrl: string };
  userEmail: string;
}) => {
  const isEnabling = !!setupData;
  const { copied, handleCopy } = useCopy();

  const [step, setStep] = React.useState<"request" | "verify">(isEnabling ? "verify" : "request");
  const [resetToken, setResetToken] = React.useState<string | null>(null);

  const { mutate: toggle, isPending } = useAction(
    (code: string) => toggle2fa(userId, code, setupData?.secret, resetToken ?? undefined),
    {
      invalidate: ["current-user"],
      successMsg: `2FA ${isEnabling ? "enabled" : "disabled"} successfully`,
      onSuccess: AppModal.close,
    }
  );

  const { mutate: sendCode, isPending: isSending } = useAction((id: string) => initiate2faReset(id), {
    successMsg: "Verification code sent to your email",
    errorMsg: "Failed to send verification code",
    onSuccess: (data) => {
      setResetToken(data.resetToken);
      setStep("verify");
    },
  });

  const form = RHF.useForm({
    resolver: zodResolver($2faSchema),
    defaultValues: { code: "" },
  });

  if (step === "request") {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-muted-foreground text-sm">
          For your security, we can send a 6-digit code to{" "}
          <span className="text-foreground font-medium">{userEmail}</span>, or you can use your authenticator app code
          instead.
        </p>
        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => AppModal.close()}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              isLoading={isSending}
              disabled={isSending}
              onClick={() => sendCode(userId)}
            >
              Send Code
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("verify")}>
            Use authenticator app instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit((d) => toggle(d.code))} className="flex flex-col items-center gap-6">
      {isEnabling ? (
        <>
          <div className="border-border w-full overflow-hidden rounded-xl border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <p className="font-mono text-sm tracking-widest break-all select-all">{setupData.secret}</p>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={copied ? "Copied" : "Copy code"}
                onClick={() => handleCopy({ text: setupData.secret, message: "Secret copied to clipboard" })}
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              >
                {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
            <div className="flex items-center justify-center p-4">
              <img src={setupData.qrCodeDataUrl} alt="QR" className="h-56 w-56 rounded-lg" />
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          {resetToken ? "Enter the 6-digit code sent to your email." : "Enter your authenticator app code."}
        </p>
      )}

      <RHF.Controller
        control={form.control}
        name="code"
        render={({ field, fieldState: { error } }) => (
          <div className="flex flex-col items-center gap-2">
            <InputOTP
              maxLength={6}
              value={field.value}
              onChange={field.onChange}
              onComplete={() => form.handleSubmit((d) => toggle(d.code))()}
              disabled={isPending || form.formState.isSubmitting}
            >
              <InputOTPGroup>
                {[...Array(6)].map((_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-14 text-xl" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {error && <p className="text-destructive text-center text-xs">{error.message}</p>}
          </div>
        )}
      />

      {isEnabling ? (
        <Button
          type="submit"
          className="w-full"
          isLoading={isPending}
          disabled={isPending || form.formState.isSubmitting}
        >
          Set Up Authenticator App
        </Button>
      ) : (
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => AppModal.close()}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            isLoading={isPending}
            disabled={isPending || form.formState.isSubmitting}
          >
            Confirm Disable
          </Button>
        </div>
      )}
    </form>
  );
};

const SecurityTabContent = ({ user }: { user: User }) => {
  const { mutate: handleToggle, isPending: isToggling } = useAction(
    async (checked: boolean) => {
      if (checked) {
        const response = await setup2fa(user.id);
        return { ...response, isEnabling: true };
      } else {
        AppModal.open({
          title: "Disable two-factor authentication",
          description: "Enter the current 6-digit code from your authenticator app to confirm.",
          size: "small",
          content: <$2faModal userId={user.id} userEmail={user.email} />,
        });
        return { isEnabling: false };
      }
    },

    {
      invalidate: ["current-user"],
      onSuccess: (data) => {
        if ("isEnabling" in data && data.isEnabling && "secret" in data && "qrCodeDataUrl" in data) {
          AppModal.open({
            title: "Authenticator App",
            size: "small",
            showCloseButton: true,
            content: <$2faModal userId={user.id} setupData={data} userEmail={user.email} />,
          });
        } else if ("isEnabling" in data && !data.isEnabling) {
          AppModal.open({
            title: "Disable two-factor authentication",
            description: "Enter the current 6-digit code from your authenticator app to confirm.",
            size: "small",
            content: <$2faModal userId={user.id} userEmail={user.email} />,
          });
        }
      },
    }
  );

  const isTwoFactorEnabled = !!user.$2faSecret;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {isTwoFactorEnabled ? (
                <ShieldCheck className="text-primary h-5 w-5" />
              ) : (
                <ShieldOff className="text-muted-foreground h-5 w-5" />
              )}
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security by requiring a verification code from your authenticator app on each
              sign-in.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {isTwoFactorEnabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-8"
                onClick={() =>
                  AppModal.open({
                    title: "Reset two-factor authentication",
                    description:
                      "If you've lost access to your authenticator app, verify your email to reset 2FA. You can set it up again afterwards.",
                    size: "small",
                    showCloseButton: true,
                    content: <$2faModal userId={user.id} userEmail={user.email} />,
                  })
                }
              >
                <RotateCcw className="size-4" />
              </Button>
            )}
            <Switch
              checked={isTwoFactorEnabled}
              onCheckedChange={handleToggle}
              disabled={isToggling}
              aria-label="Toggle two-factor authentication"
              className="cursor-pointer"
            />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useCookieState("settings_tab", "profile");
  const { data: orgContext } = useOrgContext();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
  });

  const { data: organization, isLoading: isLoadingOrg } = useQuery({
    queryKey: ["organization", orgContext?.id],
    queryFn: () => retrieveOrganization(orgContext!.id),
    enabled: !!orgContext?.id,
  });

  if (!user && !isLoadingUser) return null;

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-6 p-4 sm:p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>Settings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <UnderlineTabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <UnderlineTabsList>
                <UnderlineTabsTrigger value="profile">Profile</UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="organization">Organization</UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="api">API Keys</UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="security">Security</UnderlineTabsTrigger>
              </UnderlineTabsList>

              <UnderlineTabsContent value="profile" className="mt-6 space-y-6">
                {user ? (
                  <ProfileTabContent key={user.id} user={user} />
                ) : (
                  <div className="space-y-6">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                  </div>
                )}
              </UnderlineTabsContent>

              <UnderlineTabsContent value="organization" className="mt-6 space-y-6">
                {organization ? (
                  <OrganizationTabContent key={organization.id} organization={organization} />
                ) : isLoadingOrg ? (
                  <div className="space-y-6">
                    <Skeleton className="h-32 w-full rounded-lg" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                  </div>
                ) : null}
              </UnderlineTabsContent>

              <UnderlineTabsContent value="security" className="mt-6 space-y-6">
                {user ? (
                  <SecurityTabContent key={user.id} user={user} />
                ) : (
                  <Skeleton className="h-32 w-full rounded-lg" />
                )}
              </UnderlineTabsContent>

              <UnderlineTabsContent value="api" className="mt-6 space-y-6">
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>Manage your API keys for authenticating requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">
                        Create and manage API keys to authenticate your requests to the Stellar Tools API.
                      </p>
                      <Link href="/api-keys">
                        <Button variant="outline" className="gap-2 shadow-none">
                          Manage API Keys
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Webhooks</CardTitle>
                    <CardDescription>Configure webhook destinations for event notifications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">
                        Set up webhooks to receive real-time notifications about events in your account.
                      </p>
                      <Link href="/webhooks">
                        <Button variant="outline" className="gap-2 shadow-none">
                          Manage Webhooks
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </UnderlineTabsContent>
            </UnderlineTabs>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}
