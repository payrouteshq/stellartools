import {
  Code,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Receipt,
  Repeat,
  Settings2,
  Store,
  Users,
  Wallet,
} from "lucide-react";

export type DashboardNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: { title: string; url: string }[];
};

export const navMain: DashboardNavItem[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Products", url: "/products", icon: Package },
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Subscriptions", url: "/subscriptions", icon: Repeat },
  { title: "Payout", url: "/payout", icon: Wallet },
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
