"use client";

import * as React from "react";

import {
  AddUserIcon,
  DollarIcon,
  GroupedUsersIcon,
  HourglassIcon,
  LoopIcon,
  SubscriptionIcon,
} from "@/components/icon";
import ModeToggle from "@/components/mode-toggle";
import { StatCard } from "@/components/stat-card";
import { navMain } from "@/lib/dashboard-nav";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Switch,
  cn,
  toast,
  useIsMobile,
} from "@stellartools/shared-ui";
import { type Variants, motion } from "framer-motion";
import { Building2, ChevronsUpDown, Info, Menu, X } from "lucide-react";
import Image from "next/image";

import { formatUsd, installedApps, mockOrgs, mockUser } from "./mock-data";
import { InstalledAppsDock, PluginLauncherDrawer } from "./plugin-launcher-demo";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18, rotate: -0.6 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

const statMeta = [
  { key: "activeTrials", title: "Active Trials", subtitle: "In total", icon: HourglassIcon, color: "var(--chart-1)" },
  {
    key: "activeSubscriptions",
    title: "Active Subscriptions",
    subtitle: "In total",
    icon: SubscriptionIcon,
    color: "var(--chart-2)",
  },
  { key: "mrr", title: "MRR", subtitle: "Monthly Recurring Revenue", icon: LoopIcon, color: "var(--chart-2)" },
  { key: "grossVolume", title: "Gross volume", subtitle: "Last 30 days", icon: DollarIcon, color: "var(--chart-2)" },
  { key: "newCustomers", title: "New Customers", subtitle: "Last 30 days", icon: AddUserIcon, color: "var(--chart-3)" },
  {
    key: "totalCustomers",
    title: "Active Customers",
    subtitle: "In total",
    icon: GroupedUsersIcon,
    color: "var(--chart-3)",
  },
] as const;

export function DashboardShowcase() {
  const [orgId, setOrgId] = React.useState(mockOrgs[0].id);
  const [navOpen, setNavOpen] = React.useState(false);
  const [activeAppId, setActiveAppId] = React.useState<string | null>(null);
  const isMobile = useIsMobile();
  const org = mockOrgs.find((o) => o.id === orgId) ?? mockOrgs[0];
  const activeApp = installedApps.find((a) => a.id === activeAppId) ?? null;

  const handleSwitchOrg = (id: string) => {
    if (id === orgId) return;
    setOrgId(id);
    setNavOpen(false);
  };

  const cards = [
    { ...statMeta[0], value: org.stats.activeTrials, sparkData: org.charts.trials },
    { ...statMeta[1], value: org.stats.activeSubscriptions, sparkData: org.charts.activeSubscriptions },
    { ...statMeta[2], value: formatUsd(org.stats.mrrCents), sparkData: org.charts.mrr },
    { ...statMeta[3], value: formatUsd(org.stats.grossVolumeCents), sparkData: org.charts.grossVolume },
    { ...statMeta[4], value: org.stats.newCustomers, sparkData: org.charts.customers },
    { ...statMeta[5], value: org.stats.totalCustomers, sparkData: org.charts.customers },
  ];

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className="border-border bg-muted/30 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/10"
    >
      <motion.div
        custom={0}
        variants={fadeUp}
        className="bg-primary border-border flex items-center justify-center gap-2 px-6 py-1"
      >
        <Info className="text-secondary-foreground size-3.5" />
        <span className="text-secondary-foreground text-xs">
          You are in <span className="font-medium">Test mode</span>
        </span>
      </motion.div>

      <SidebarProvider
        className="relative min-h-0! w-full"
        style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
      >
        {isMobile && navOpen && (
          <div className="absolute inset-0 z-20 bg-black/40" onClick={() => setNavOpen(false)} aria-hidden />
        )}

        <div
          className={cn(
            "flex",
            isMobile &&
              cn(
                "absolute inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-out",
                navOpen ? "translate-x-0" : "pointer-events-none -translate-x-full"
              )
          )}
        >
          <Sidebar collapsible="none" className="border-border">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton size="lg">
                        <div className="flex size-6 items-center justify-center overflow-hidden rounded-sm border">
                          {org.logoUrl ? (
                            <Image src={org.logoUrl} alt={org.name} width={24} height={24} className="object-cover" />
                          ) : (
                            <Building2 className="size-4" />
                          )}
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">{org.name}</span>
                          <span className="text-muted-foreground truncate text-xs">Your organization</span>
                        </div>
                        <ChevronsUpDown className="ml-auto" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56" align="start">
                      <DropdownMenuLabel className="text-muted-foreground text-xs">Organizations</DropdownMenuLabel>
                      {mockOrgs.map((o) => (
                        <DropdownMenuItem key={o.id} onClick={() => handleSwitchOrg(o.id)} className="gap-2">
                          <div className="flex size-6 items-center justify-center overflow-hidden rounded-sm border">
                            {o.logoUrl ? (
                              <Image src={o.logoUrl} alt={o.name} width={24} height={24} className="object-cover" />
                            ) : (
                              <Building2 className="size-4" />
                            )}
                          </div>
                          <span className="flex-1 truncate">{o.name}</span>
                          {o.id === org.id && <DropdownMenuShortcut>✓</DropdownMenuShortcut>}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarMenu>
                  {navMain.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton isActive={item.url === "/"}>
                        <item.icon className={cn(item.url === "/" && "text-muted-foreground")} />
                        <span className={cn(item.url === "/" && "text-muted-foreground font-medium")}>
                          {item.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={mockUser.avatarUrl} className="object-cover" />
                      <AvatarFallback className="rounded-lg">{mockUser.initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{mockUser.name}</span>
                      <span className="truncate text-xs">{mockUser.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
        </div>

        <SidebarInset className="bg-sidebar m-0 flex flex-1 flex-col p-0">
          <motion.header
            custom={0.18}
            variants={fadeUp}
            className="flex h-14 shrink-0 items-center justify-between gap-4 px-3 md:h-16 md:px-6"
          >
            <div className="flex items-center gap-2">
              {isMobile && (
                <button
                  onClick={() => setNavOpen((v) => !v)}
                  className="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md"
                  aria-label={navOpen ? "Close navigation" : "Open navigation"}
                >
                  {navOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ModeToggle />
              <div className="flex items-center gap-2">
                <Switch checked disabled className="h-5 w-9 [&>span]:size-4" />
                <span className="text-muted-foreground text-xs">Sandbox data</span>
              </div>
            </div>
          </motion.header>

          <div className="border-border bg-card rounded-tl-4xl border-l">
            <div className={cn("p-5 md:p-7 lg:p-10", isMobile && "max-h-[60vh] overflow-y-auto overscroll-contain")}>
              <motion.div
                custom={0.24}
                variants={fadeUp}
                className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-8"
              >
                <h3 className="text-foreground text-lg font-bold tracking-tight lg:text-xl">Overview</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border-border/80 text-muted-foreground rounded-lg border px-3 py-1.5 text-xs">
                    Last 30 days
                  </span>
                  <span className="border-border/80 text-muted-foreground rounded-lg border px-3 py-1.5 text-xs">
                    US Dollar (USD)
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } } }}
                className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5"
              >
                {cards.map((c) => (
                  <motion.div key={c.title} variants={fadeUp} custom={0}>
                    <StatCard
                      title={c.title}
                      value={c.value}
                      subtitle={c.subtitle}
                      icon={<c.icon className="text-muted-foreground size-3.5 lg:size-4" />}
                      sparkData={c.sparkData}
                      color={c.color}
                      interactive={false}
                      compact
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <InstalledAppsDock activeAppId={activeAppId} onSelect={setActiveAppId} />
      <PluginLauncherDrawer app={activeApp} onClose={() => setActiveAppId(null)} />
    </motion.div>
  );
}
