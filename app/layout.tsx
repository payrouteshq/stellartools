import { Toaster } from "@/components/ui/toast";
import ThemeProvider from "@/providers";
import { Providers } from "@/providers";
import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  variable: "--font-instrument-serif",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stellar Tools",
  description: "The financial infrastructure for the Stellar economy.",
  openGraph: {
    title: "Stellar Tools",
    description: "The financial infrastructure for the Stellar economy.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Stellar Tools - The financial infrastructure for the Stellar economy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stellar Tools",
    description: "The financial infrastructure for the Stellar economy.",
    images: ["/images/og-image.png"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${jetBrainsMono.variable} ${instrumentSerif.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Providers>
            {children}
            <Toaster position="bottom-right" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
