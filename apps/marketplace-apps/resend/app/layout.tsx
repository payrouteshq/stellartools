import { StellarToolsAppBootstrap } from "@stellartools/app-sdk";
import { Toaster } from "@stellartools/shared-ui";

import "./globals.css";
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StellarToolsAppBootstrap baseUrl={process.env.NEXT_PUBLIC_APP_URL ?? "/"} />
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
