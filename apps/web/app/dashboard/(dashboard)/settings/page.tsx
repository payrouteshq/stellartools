"use client";

import * as React from "react";

import { initiate2faReset, setup2fa, toggle2fa } from "@/actions/2fa";
import { putAccount } from "@/actions/account";
import { getCurrentUser } from "@/actions/auth";
import { putOrganization, retrieveOrganization } from "@/actions/organization";
import { retrieveWalletBalance } from "@/actions/payout";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useAction } from "@/hooks/use-action";
import { useCookieState } from "@/hooks/use-cookie-state";
import { useCurrencyConverter } from "@/hooks/use-currency-converter";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AppModal,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FileUpload,
  type FileWithPreview,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
  PhoneNumber,
  PhoneNumberField,
  SelectField,
  Separator,
  Skeleton,
  Spinner,
  Switch,
  TextAreaField,
  TextField,
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  phoneNumberFromString,
  phoneNumberSchema,
  useCopy,
  useFilePreview,
} from "@stellartools/shared-ui";
import { useQuery } from "@tanstack/react-query";
import countryToCurrency from "country-to-currency";
import { Calendar, Check, ChevronRight, Copy, ExternalLink, RotateCcw } from "lucide-react";
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
  selectedCurrency: Schema.string(),
  receiptEmails: Schema.boolean(),
});

type OrganizationFormData = Schema.infer<typeof organizationSchema>;

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type Organization = Awaited<ReturnType<typeof retrieveOrganization>>;

const ProfileTabContent = ({ user }: { user: User }) => {
  const { file, isLoading: imgLoading } = useFilePreview(user.profile?.avatarUrl);
  const { data: orgContext } = useOrgContext();

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

  const { mutate: handleToggle2fa, isPending: isToggling2fa } = useAction(
    async (checked: boolean) => {
      if (checked) {
        if (!orgContext?.name) return { isEnabling: false };
        const response = await setup2fa(user.id, orgContext.name);
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
              maxDimension={1024}
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
        <CardContent className="space-y-6">
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

          <Separator />

          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold">Two-Factor Authentication</p>
              <p className="text-muted-foreground text-xs">
                Add an extra layer of security by requiring a verification code from your authenticator app on each
                sign-in.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
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
                onCheckedChange={handleToggle2fa}
                disabled={isToggling2fa}
                aria-label="Toggle two-factor authentication"
                className="cursor-pointer"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

// Build currency → country map for flag lookup
const currencyToCountry: Record<string, string> = {};
for (const [country, currency] of Object.entries(countryToCurrency)) {
  if (!currencyToCountry[currency]) currencyToCountry[currency] = country;
}
// Override shared currencies with the most recognisable country
Object.assign(currencyToCountry, {
  USD: "US",
  EUR: "EU",
  GBP: "GB",
  AUD: "AU",
  CAD: "CA",
  CHF: "CH",
  JPY: "JP",
  CNY: "CN",
});

const getCurrencyFlag = (currencyCode: string): string => {
  const country = currencyToCountry[currencyCode];
  if (!country || country.length !== 2) return "";
  try {
    return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
  } catch {
    return "";
  }
};

const OrganizationTabContent = ({ organization }: { organization: Organization }) => {
  const { data: orgContext } = useOrgContext();
  const { copied: orgIdCopied, handleCopy: handleOrgIdCopy } = useCopy();
  const { copied: publicKeyCopied, handleCopy: handlePublicKeyCopy } = useCopy();
  const { data: walletData } = useOrgQuery(["wallet-balance"], () => retrieveWalletBalance());

  const { file, isLoading: imgLoading } = useFilePreview(organization.logoUrl);
  const { fiatRates, isLoading: isLoadingCurrencies } = useCurrencyConverter();

  const currencyItems = React.useMemo(() => {
    if (!fiatRates) return [];
    return Object.keys(fiatRates)
      .map((code) => ({ code, name: currencyNames.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fiatRates]);

  const form = RHF.useForm({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      id: organization.id,
      name: organization.name,
      description: organization.description ?? "",
      logo: undefined,
      phoneNumber: organization.phoneNumber ? phoneNumberFromString(organization.phoneNumber) : undefined,
      selectedCurrency: organization.selectedCurrency,
      receiptEmails: organization.settings?.disableNativeEmails !== true,
    },
    values: {
      id: organization.id,
      name: organization.name,
      description: organization.description ?? "",
      logo: file,
      phoneNumber: organization.phoneNumber ? phoneNumberFromString(organization.phoneNumber) : undefined,
      selectedCurrency: organization.selectedCurrency,
      receiptEmails: organization.settings?.disableNativeEmails !== true,
    },
  });

  const { mutate: updateOrganization, isPending: isSubmitting } = useAction(
    async (data: OrganizationFormData) => {
      if (!orgContext?.id) return;
      const formData = new FormData();
      if (data.logo instanceof File) formData.set("logo", data.logo);
      await putOrganization(
        orgContext.id,
        {
          name: data.name,
          description: data.description || null,
          selectedCurrency: data.selectedCurrency,
          settings: { ...(organization.settings ?? {}), disableNativeEmails: !data.receiptEmails },
        },
        { formDataWithFiles: formData }
      );
      return true;
    },
    {
      invalidate: [
        ["organization", orgContext?.id ? orgContext.id : undefined],
        ["sidebar-organizations"],
        ["org-context"],
        "*",
      ],
      successMsg: "Organization settings updated",
      errorMsg: "Failed to update organization settings",
    }
  );

  const logo = form.watch("logo");

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <FileUpload
              label={null}
              value={logo ? [logo] : undefined}
              onFilesChange={(files) => form.setValue("logo", files[0])}
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
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit((data) => updateOrganization(data))} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <RHF.Controller
                  control={form.control}
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
                  control={form.control}
                  name="phoneNumber"
                  render={({ field, fieldState: { error } }) => (
                    <PhoneNumberField
                      id="phone-number"
                      label="Phone Number"
                      value={field.value ? (field.value as PhoneNumber) : { number: "", countryCode: "US" }}
                      onChange={field.onChange}
                      error={error?.message || null}
                      disabled={isSubmitting}
                      groupClassName="w-full shadow-none"
                    />
                  )}
                />

                <RHF.Controller
                  control={form.control}
                  name="selectedCurrency"
                  render={({ field }) => (
                    <SelectField
                      id="display-currency"
                      label="Display currency"
                      helpText="Used across your dashboard and shown to customers at checkout."
                      helpTextClassName="text-muted-foreground text-xs"
                      value={field.value}
                      onChange={field.onChange}
                      isLoading={isLoadingCurrencies}
                      className="w-full shadow-none"
                      triggerClassName="w-full shadow-none"
                      items={currencyItems.map((item) => {
                        const flag = getCurrencyFlag(item.code);
                        return {
                          value: item.code,
                          label: `${item.name} (${item.code})`,
                          icon: flag ? <span className="text-base leading-none">{flag}</span> : undefined,
                        };
                      })}
                    />
                  )}
                />
              </div>

              <div className="space-y-6">
                <RHF.Controller
                  name="id"
                  control={form.control}
                  render={({ field, fieldState: { error } }) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Organization ID</Label>
                      <div className="relative w-full">
                        <Input
                          id={field.name}
                          value={field.value}
                          disabled
                          className="w-full pr-10 font-mono shadow-none"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={orgIdCopied ? "Copied" : "Copy organization ID"}
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 size-8 -translate-y-1/2 shadow-none"
                          onClick={() => handleOrgIdCopy({ text: field.value, message: "Copied to clipboard" })}
                        >
                          {orgIdCopied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                        </Button>
                      </div>
                      {error?.message && <p className="text-destructive text-sm">{error.message}</p>}
                    </div>
                  )}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="organization-public-key">Wallet public key</Label>
                    <Badge
                      variant={organization.walletStrategy === "direct" ? "outline" : "secondary"}
                      className={
                        organization.walletStrategy === "direct"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-500 text-[11px] px-1.5 py-0"
                          : "bg-emerald-500/10 text-emerald-500 text-[11px] px-1.5 py-0"
                      }
                    >
                      {organization.walletStrategy === "direct" ? "Self-custody" : "Managed"}
                    </Badge>
                  </div>
                  <div className="relative w-full">
                    <Input
                      id="organization-public-key"
                      value={walletData?.publicKey ?? ""}
                      disabled
                      className="w-full pr-10 font-mono shadow-none"
                    />
                    {walletData?.publicKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={publicKeyCopied ? "Copied" : "Copy public key"}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 size-8 -translate-y-1/2 shadow-none"
                        onClick={() =>
                          handlePublicKeyCopy({ text: walletData.publicKey!, message: "Copied to clipboard" })
                        }
                      >
                        {publicKeyCopied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
                      </Button>
                    )}
                  </div>
                </div>

                <RHF.Controller
                  control={form.control}
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
              </div>
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold">Receipt emails</p>
                <p className="text-muted-foreground text-xs">
                  StellarTools sends payment receipts to customers and first-payment alerts to you. Turn this off if a
                  marketplace app like Resend or Loops is already handling emails for you.
                </p>
              </div>
              <RHF.Controller
                control={form.control}
                name="receiptEmails"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5 shrink-0 cursor-pointer"
                    aria-label="Toggle receipt emails"
                  />
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button isLoading={isSubmitting} type="submit" disabled={isSubmitting} className="shadow-none">
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Send a one-time code to <span className="text-foreground font-medium">{userEmail}</span>, or verify with your
          authenticator app directly.
        </p>
        <Button
          type="button"
          className="w-full"
          isLoading={isSending}
          disabled={isSending}
          onClick={() => sendCode(userId)}
        >
          Send code to email
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => setStep("verify")}>
          Use authenticator app
        </Button>
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useCookieState("settings_tab", "profile");
  const { data: orgContext } = useOrgContext();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUser(),
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
