"use client";

import "@/app/globals.css";
import { Toaster } from "@stellartools/shared-ui";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
