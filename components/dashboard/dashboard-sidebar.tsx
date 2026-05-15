"use client";

import * as React from "react";

import { getCurrentUser, signOut } from "@/actions/auth";
import { retrieveOrganizations, setCurrentOrganization } from "@/actions/organization";
import { AppModal } from "@/components/app-modal";
import { TestModeBanner } from "@/components/environment-mode";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,

} from "@/components/ui/sidebar";
import { toast } from "@/components/ui/toast";
import { useOrgContext } from "@/hooks/use-org-query";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Bell,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  Code,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  Receipt,
  Repeat,
  Settings2,
  Sparkles,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navMain = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Products", url: "/products", icon: Package },
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Subscriptions", url: "/subscriptions", icon: Repeat },
  { title: "Payout", url: "/payout", icon: Wallet },
  { title: "Usage", url: "/usage", icon: Activity },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "Settings", url: "/settings", icon: Settings2 },
  {
    title: "Developers",
    url: "/developers",
    icon: Code,
    items: [
      { title: "API Keys", url: "/api-keys" },
      { title: "Webhooks", url: "/webhooks" },
      { title: "Documentation", url: `${process.env.NEXT_PUBLIC_DOCS_URL!}` },
    ],
  },
];

export function DashboardSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSwitching, setIsSwitching] = React.useState(false);

  const { data: orgContext } = useOrgContext();
  const { data: user } = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const { data: organizations, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ["sidebar-organizations"],
    queryFn: async () => await retrieveOrganizations(),
  });
  const currentOrg = organizations?.find((org) => org.id === orgContext?.id) || null;
  const isTestMode = orgContext?.environment === "testnet";

  const userName = user?.profile.firstName
    ? `${user.profile.firstName} ${user.profile.lastName || ""}`.trim()
    : user?.email.split("@")[0] || "User";

  const userInitials = (user?.profile.firstName?.[0] || user?.email?.[0] || "?").toUpperCase();

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname?.startsWith(url));

  const handleSwitchOrganization = async (orgId: string) => {
    if (!currentOrg || orgId === currentOrg.id) return;
    setIsSwitching(true);
    try {
      await setCurrentOrganization(orgId, orgContext?.environment || "testnet");
      queryClient.invalidateQueries({ queryKey: ["org-context"] });
      toast.success("Organization switched");
      router.refresh();
    } catch {
      toast.error("Failed to switch organization");
    } finally {
      setIsSwitching(false);
    }
  };

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
      router.push("/signin");
      AppModal.close();
    } catch (error) {
      toast.error("Failed to log out");
      console.error("Logout error:", error);
    }
  }, [router]);

  return (
    <div className="flex min-h-svh flex-col">
      {isTestMode && <TestModeBanner />}
      <SidebarProvider className="min-h-0 flex-1">
        <Sidebar collapsible="icon">
          <SidebarHeader className={cn(isTestMode && "pt-8 transition-all duration-300")}>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" disabled={isSwitching} tooltip={currentOrg?.name ?? "Organization"}>
                      <div className="text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                        {currentOrg?.logoUrl ? (
                          <Image
                            src={currentOrg.logoUrl}
                            alt=""
                            width={32}
                            height={32}
                            className="size-full object-cover"
                          />
                        ) : (
                          <Building2 className="size-4" />
                        )}
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-semibold">{currentOrg?.name || "Loading..."}</span>
                        <span className="text-muted-foreground truncate text-xs">Your organization</span>
                      </div>
                      <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                    align="start"
                    side="bottom"
                  >
                    <DropdownMenuLabel className="text-muted-foreground text-xs">Organizations</DropdownMenuLabel>
                    {isLoadingOrgs ? (
                      <DropdownMenuItem disabled>
                        <div className="flex size-6 items-center justify-center">
                          <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                        </div>
                        Loading ...
                      </DropdownMenuItem>
                    ) : (
                      organizations?.map((org) => (
                        <DropdownMenuItem
                          key={org.id}
                          onClick={() => handleSwitchOrganization(org.id)}
                          className="gap-2"
                          disabled={isSwitching}
                        >
                          <div className="flex size-6 items-center justify-center overflow-hidden rounded-sm border">
                            {org.logoUrl ? (
                              <Image src={org.logoUrl} alt="" width={24} height={24} />
                            ) : (
                              <Building2 className="size-4" />
                            )}
                          </div>
                          <span className="flex-1 truncate">{org.name}</span>
                          {currentOrg?.id === org.id && <DropdownMenuShortcut>✓</DropdownMenuShortcut>}
                        </DropdownMenuItem>
                      ))
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/select-organization?create=true" className="gap-2">
                        <Plus className="size-4" /> <span>Create organization</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {navMain.map((item) => {
                  const active = isActive(item.url);
                  const hasSubItems = item.items && item.items.length > 0;
                  const subActive = item.items?.some((sub) => isActive(sub.url));

                  if (hasSubItems) {
                    return (
                      <Collapsible key={item.title} asChild defaultOpen={subActive} className="group/collapsible">
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.title} isActive={active || subActive}>
                              {item.icon && (
                                <item.icon className={cn((active || subActive) && "text-muted-foreground")} />
                              )}
                              <span className={cn((active || subActive) && "text-muted-foreground font-medium")}>
                                {item.title}
                              </span>
                              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.items?.map((sub) => (
                                <SidebarMenuSubItem key={sub.title}>
                                  <SidebarMenuSubButton asChild isActive={isActive(sub.url)}>
                                    <Link href={sub.url} target={sub.url.startsWith("http") ? "_blank" : undefined}>
                                      <span className={cn(isActive(sub.url) && "text-muted-foreground font-medium")}>
                                        {sub.title}
                                      </span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title} isActive={active}>
                        <Link href={item.url} target={item.url.startsWith("http") ? "_blank" : undefined}>
                          {item.icon && <item.icon className={cn(active && "text-muted-foreground")} />}
                          <span className={cn(active && "text-muted-foreground font-medium")}>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={user?.profile.avatarUrl || ""} />
                        <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{userName}</span>
                        <span className="truncate text-xs">{user?.email}</span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                    side="bottom"
                    align="end"
                  >
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
                        <Avatar className="h-8 w-8 rounded-lg">
                          <AvatarImage src={user?.profile.avatarUrl || ""} />
                          <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left leading-tight">
                          <span className="truncate font-semibold">{userName}</span>
                          <span className="truncate text-xs">{user?.email}</span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild className="gap-2">
                        <Link href="/settings">
                          <BadgeCheck className="size-4" /> Account
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <Bell className="size-4" /> Notifications
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive gap-2"
                      onClick={() =>
                        AppModal.open({
                          title: "Log out",
                          description:
                            "Are you sure you want to log out? You'll need to sign in again to access your account.",
                          content: (
                            <div className="py-4">
                              <p className="text-muted-foreground text-sm">
                                This will end your current session and you&apos;ll be redirected to the sign in page.
                              </p>
                            </div>
                          ),
                          size: "small",
                          showCloseButton: true,
                          primaryButton: { children: "Log out", variant: "destructive", onClick: handleLogout },
                          secondaryButton: { children: "Cancel" },
                        })
                      }
                    >
                      <LogOut className="size-4" /> Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        {children}
      </SidebarProvider>
    </div>
  );
}
