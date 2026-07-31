import { Skeleton, cn } from "@stellartools/shared-ui";

export function CheckoutSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-background flex min-h-screen flex-col", className)}>
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Left: order summary */}
        <div className="border-border flex flex-col justify-center border-b px-6 py-12 sm:px-10 sm:py-16 lg:border-r lg:border-b-0 lg:px-16 lg:py-16">
          <div className="mx-auto w-full max-w-md space-y-8">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <Skeleton className="h-4 w-28 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-8 w-2/3 rounded-md" />
            </div>
            <Skeleton className="h-px w-full rounded-none" />
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-10 w-40 rounded-md" />
              <Skeleton className="h-8 w-24 shrink-0 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right: customer details + pay */}
        <div
          id="checkout-payment-panel"
          className="dark bg-background flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16"
        >
          <div className="mx-auto w-full max-w-md space-y-8">
            <Skeleton className="h-6 w-40 rounded-md" />
            <div className="space-y-4">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
