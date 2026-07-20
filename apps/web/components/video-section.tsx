import Image from "next/image";

export function VideoSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="border-border bg-muted/30 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/10">
        <Image
          src="/images/dashboard.png"
          alt="StellarTools dashboard overview"
          width={3036}
          height={1946}
          className="h-auto w-full"
          priority
        />
      </div>
    </section>
  );
}
