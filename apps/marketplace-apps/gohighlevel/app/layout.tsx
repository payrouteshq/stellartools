import "./globals.css";

export const metadata = {
  title: "StellarTools for GoHighLevel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
