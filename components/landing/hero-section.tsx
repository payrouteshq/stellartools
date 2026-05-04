import Image from "next/image";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center gap-12 px-6 pt-24 pb-20 lg:gap-20">
      <div className="flex flex-col items-center text-center">
        <div className="border-secondary/25 bg-secondary/10 text-foreground mb-6 flex flex-col items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold tracking-wide sm:flex-row">
          <span className="bg-secondary text-secondary-foreground text-clamp(8px,1.5vw,13px) rounded-full px-1.5 py-0.5">
            NEW
          </span>
          <span className="text-muted-foreground font-medium">Now with LangChain &amp; AI SDK support</span>
        </div>

        <h1 className="text-foreground mb-6 text-[clamp(42px,5vw,62px)] leading-[1.1] font-extrabold tracking-normal">
          The financial infrastructure
          <br />
          for the
          <span className="text-secondary ml-2">Stellar economy.</span>
        </h1>

        <p className="text-muted-foreground mx-auto mb-9 max-w-[580px] text-lg leading-relaxed font-normal">
          Accept payments, manage subscriptions, issue refunds, and automate billing, all on the Stellar network. A
          complete payments platform your customers interact with in seconds.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="https://dashboard.stellartools.dev"
            target="_blank"
            className="bg-primary text-primary-foreground rounded-xl px-7 py-3.5 text-base font-semibold no-underline transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(91,79,255,0.35)]"
          >
            Start building free
          </Link>
          <Link
            href="#how-it-works"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-lg px-4 py-2 text-[15px] font-medium no-underline transition-colors"
          >
            See how it works →
          </Link>
        </div>
      </div>

      <div className="relative w-full max-w-[900px] overflow-hidden rounded-xl shadow-2xl">
        <Image
          src="/images/overview-dashboard.png"
          alt="Overview Dashboard Screenshot"
          width={1300}
          height={900}
          className="w-full"
        />
        <div className="from-primary to-primary absolute top-0 right-0 left-0 h-[4px] bg-linear-to-b" />
        <div className="absolute right-0 bottom-0 left-0 h-[5%] bg-gray-50" />
      </div>
    </section>
  );
}
