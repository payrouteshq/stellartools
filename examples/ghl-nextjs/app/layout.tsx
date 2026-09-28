import * as React from "react";

export const metadata = {
  title: "GoHighLevel Checkout Simulator",
  description: "Local testing simulator for GoHighLevel checkout iframe integration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
