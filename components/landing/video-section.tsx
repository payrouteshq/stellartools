import { Play } from "lucide-react";

export function VideoSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="border-border bg-muted/30 relative aspect-video w-full overflow-hidden rounded-2xl border">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="border-border bg-background flex size-14 items-center justify-center rounded-full border shadow-sm">
            <Play className="text-foreground ml-0.5 size-5" />
          </div>
          <p className="text-muted-foreground text-sm">Demo video coming soon</p>
        </div>
      </div>
    </section>
  );
}
