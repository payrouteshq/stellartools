import { AppModalProvider } from "@stellartools/shared-ui";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppModalProvider>{children}</AppModalProvider>;
}
