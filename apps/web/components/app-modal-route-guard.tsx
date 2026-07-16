"use client";

import * as React from "react";

import { AppModal } from "@stellartools/shared-ui";
import { usePathname } from "next/navigation";

// A modal opened on one route shouldn't survive navigating to another. Closing it from
// the page that opened it is unreliable — that page can unmount as part of the very
// navigation that's supposed to trigger the close, so the call never fires. This lives
// in the persistent dashboard layout instead (see app/dashboard/layout.tsx), which stays
// mounted across all its child routes, and closes the modal once the pathname actually
// changes — i.e. once the destination route has finished rendering.
export function AppModalRouteGuard() {
  const pathname = usePathname();
  const mountedPathnameRef = React.useRef(pathname);

  React.useEffect(() => {
    if (mountedPathnameRef.current !== pathname) {
      mountedPathnameRef.current = pathname;
      AppModal.close();
    }
  }, [pathname]);

  return null;
}
