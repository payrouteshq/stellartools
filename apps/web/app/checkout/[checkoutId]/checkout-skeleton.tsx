import { Skeleton, cn } from "@stellartools/shared-ui";

export function CheckoutSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-background flex min-h-screen flex-col", className)}>
      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-start gap-8 px-4 py-10 sm:gap-10 sm:px-6 lg:max-w-6xl lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:px-8">
        {/* Left: product summary card */}
        <div className="space-y-6 lg:sticky lg:top-12">
          <div className="bg-card overflow-hidden rounded-2xl border shadow-sm lg:min-w-[360px]">
            <div className="flex items-center gap-3 border-b px-6 py-4">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded-md" />
            </div>
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-8 w-2/3 rounded-md" />
              </div>
              <Skeleton className="h-4 w-full rounded-md" />
              <div className="border-t pt-5">
                <Skeleton className="h-10 w-40 rounded-md" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: customer details + pay */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-4 w-72 max-w-full rounded-md" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="flex justify-center">
            <Skeleton className="h-3 w-40 rounded-md" />
          </div>
        </div>
      </main>
    </div>
  );
}
