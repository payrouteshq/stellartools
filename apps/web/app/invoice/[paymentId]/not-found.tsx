import { StellarToolsIcon } from "@/components/icon";
import Link from "next/link";

export default function InvoiceNotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted/40 border-border flex size-14 items-center justify-center rounded-2xl border">
        <StellarToolsIcon width={24} height={24} />
      </div>
      <div className="space-y-1">
        <h1 className="text-foreground text-lg font-semibold">Invoice not found</h1>
        <p className="text-muted-foreground text-sm">
          This invoice link may be invalid or the payment hasn&apos;t been processed yet.
        </p>
      </div>
      <Link
        href={process.env.NEXT_PUBLIC_APP_URL!}
        className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1.5 text-xs transition-colors"
      >
        Powered by StellarTools
      </Link>
    </div>
  );
}
