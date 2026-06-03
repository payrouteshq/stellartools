"use client";

import { setup2fa, toggle2fa } from "@/actions/2fa";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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
import { useFilePreview } from "@/hooks/use-file-preview";
import { useOrgContext } from "@/hooks/use-org-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronRight, ExternalLink, ShieldCheck, ShieldOff } from "lucide-react";
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
    </>
  );
};

const $2faSchema = Schema.object({
  code: Schema.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers"),
});

const $2faModal = ({
  userId,
  setupData,
}: {
  userId: string;
  setupData?: { secret: string; qrCodeDataUrl: string };
}) => {
  const isEnabling = !!setupData;

  const { mutate: toggle, isPending } = useAction((code: string) => toggle2fa(userId, code, setupData?.secret), {
    invalidate: ["current-user"],
    successMsg: `2FA ${isEnabling ? "enabled" : "disabled"} successfully`,
    onSuccess: AppModal.close,
  });

  const form = RHF.useForm({
    resolver: zodResolver($2faSchema),
    defaultValues: { code: "" },
  });

  return (
    <form onSubmit={form.handleSubmit((d) => toggle(d.code))} className="flex flex-col items-center gap-6">
      {isEnabling && (
        <div className="flex w-full flex-col items-center gap-4">
          <img src={setupData.qrCodeDataUrl} alt="QR" className="h-48 w-48 rounded-lg border shadow-sm" />
          <div className="bg-muted w-full rounded-md px-3 py-2 text-center">
            <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">Manual Key</p>
            <p className="font-mono text-xs tracking-widest break-all select-all">{setupData.secret}</p>
          </div>
        </div>
      )}

      <div className="flex w-full flex-col items-center gap-4">
        {!isEnabling && (
          <p className="text-muted-foreground text-center text-sm">Enter your code to confirm deactivation.</p>
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
            {isEnabling ? "Verify & Enable" : "Confirm Disable"}
          </Button>
        </div>
      </div>
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
          content: <$2faModal userId={user.id} />,
        });
        return { isEnabling: false };
      }
    },

    {
      invalidate: ["current-user"],
      onSuccess: (data) => {
        if ("isEnabling" in data && data.isEnabling && "secret" in data && "qrCodeDataUrl" in data) {
          AppModal.open({
            title: "Set up two-factor authentication",
            description:
              "Scan the QR code with Google Authenticator (or any TOTP app), then enter the 6-digit code to confirm.",
            size: "small",
            content: <$2faModal userId={user.id} setupData={data} />,
          });
        } else if ("isEnabling" in data && !data.isEnabling) {
          AppModal.open({
            title: "Disable two-factor authentication",
            description: "Enter the current 6-digit code from your authenticator app to confirm.",
            size: "small",
            content: <$2faModal userId={user.id} />,
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
            <Switch
              checked={isTwoFactorEnabled}
              onCheckedChange={handleToggle}
              disabled={isToggling}
              aria-label="Toggle two-factor authentication"
            />
          </div>
        </div>
      </CardHeader>
      {isTwoFactorEnabled && (
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Your account is protected with Google Authenticator (TOTP). You will need your authenticator app every time
            you sign in.
          </p>
        </CardContent>
      )}
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
