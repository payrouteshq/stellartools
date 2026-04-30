import { Link2, Palette, QrCode, Zap } from "lucide-react";

const features = [
  {
    icon: QrCode,
    title: "QR code that just works",
    description:
      "Deep links into Lobstr, xBull or other Stellar wallets with amount, memo, and destination pre-filled. One scan, one tap.",
  },
  {
    icon: Link2,
    title: "Wallet connect",
    description: "Customers can connect their wallet directly in the browser without leaving your checkout flow.",
  },
  {
    icon: Zap,
    title: "3-5 second settlement",
    description: "Stellar's consensus means payments are final in seconds — not minutes, not days.",
  },
  {
    icon: Palette,
    title: "Your brand, your look",
    description: "Custom product name, logo, and description shown at checkout. Looks like you built it yourself.",
  },
];

export default function CheckoutSection() {
  return (
    <section className="bg-primary-foreground px-6 py-24 sm:px-10" id="checkout">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2 md:gap-20">
        <div>
          <div className="text-primary mb-6 text-sm font-bold tracking-[1.5px] uppercase">Hosted Checkout</div>
          <h2 className="text-background mb-6 max-w-[520px] text-[clamp(40px,5vw,60px)] leading-[1.1] font-bold tracking-tight">
            A checkout your customers will <em className="text-primary italic">actually use.</em>
          </h2>
          <p className="mb-10 text-lg leading-relaxed text-white/60">
            No wallet setup guides. Your customers see a clean, familiar payment screen. Scan the QR and it opens their
            Stellar wallet pre-filled, ready to confirm in one tap.
          </p>

          <div className="flex flex-col gap-5">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 min-w-[36px] items-center justify-center rounded-[10px] bg-white/10">
                  <feature.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="mb-1 text-[15px] font-semibold text-white">{feature.title}</div>
                  <div className="text-[13.5px] leading-relaxed text-white/55">{feature.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="bg-card mx-auto max-w-[380px] overflow-hidden rounded-2xl shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
            <div className="bg-primary px-4 py-1.5 text-center text-[12px] text-white/85">
              ✦ StellarTools Secure Checkout
            </div>
            <div className="p-6">
              <div className="mb-6 text-center">
                <div className="text-foreground text-[36px] font-bold">10 XLM</div>
                <div className="text-muted-foreground mt-0.5 text-sm">Discord Unlimited · billed monthly</div>
              </div>

              <button className="bg-primary text-primary-foreground w-full rounded-[10px] py-3.5 text-sm font-semibold">
                Pay as GBWY…OQCH →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
