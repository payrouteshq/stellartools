import { AppModalRouteGuard } from "@/components/app-modal-route-guard";
import { AppModalProvider } from "@stellartools/shared-ui";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppModalProvider>
      <AppModalRouteGuard />
      {children}
    </AppModalProvider>
  );
}
