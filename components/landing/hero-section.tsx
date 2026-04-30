import Image from "next/image";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center gap-12 px-6 pt-24 pb-20 lg:gap-20">
      <div className="flex flex-col items-center text-center">
        <div className="bg-primary/10 text-primary mb-6 flex flex-col items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold tracking-wide sm:flex-row">
          <span className="bg-primary text-primary-foreground text-clamp(8px,1.5vw,13px) rounded-full px-1.5 py-0.5">
            NEW
          </span>
          Now with LangChain &amp; AI SDK support
        </div>

        <h1 className="text-foreground mb-6 text-[clamp(42px,5vw,62px)] leading-[1.1] font-extrabold tracking-normal">
          The financial infrastructure
          <br />
          for the
          <span className="text-primary ml-2">Stellar economy.</span>
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

        <div className="text-muted-foreground mt-12 flex items-center justify-center gap-4 text-[13px]">
          <div className="flex">
            {["P", "E", "A", "+"].map((letter, index) => (
              <div
                key={letter}
                className={`border-background bg-secondary text-primary flex h-8 w-8 items-center justify-center rounded-full border-2 text-[12px] font-semibold ${index === 0 ? "" : "-ml-2"}`}
              >
                {letter}
              </div>
            ))}
          </div>
          Trusted by developers building the next generation of products
        </div>
      </div>

      <div className="w-full max-w-[900px]">
        <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.12),0_4px_20px_rgba(91,79,255,0.08)]">
          <div className="bg-secondary border-border flex items-center gap-2 border-b px-5 py-3.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]"></div>
            <div className="bg-muted text-muted-foreground ml-3 flex-1 rounded-md px-3 py-1 font-mono text-[12px]">
              https://app.stellartools.dev/
            </div>
          </div>
          <Image
            src="/images/overview-dashboard.png"
            alt="Overview Dashboard Screenshot"
            width={1300}
            height={900}
            className="w-full"
          />
        </div>
      </div>
    </section>
  );
}
