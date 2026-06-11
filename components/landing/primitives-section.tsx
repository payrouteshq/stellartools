const primitives = [
  {
    label: "Payments",
    id: "payments",
    description: "Accept XLM, USDC, or any Stellar asset. 3-second settlement, sub-cent fees, no chargebacks.",
  },
  {
    label: "Subscriptions",
    id: "subscriptions",
    description: "Recurring billing with trial periods, pause, cancel-at-period-end, and automatic renewal.",
  },
  {
    label: "Checkout",
    id: "checkout",
    description: "Hosted payment pages with your branding. A single API call — no frontend code required.",
  },
  {
    label: "Customer Portal",
    id: "portal",
    description: "Self-service billing portal. Customers manage their own subscriptions and payment methods.",
  },
  {
    label: "Usage Billing",
    id: "usage",
    description: "Metered billing with credit pools. Charge for exactly what's consumed, nothing more.",
  },
  {
    label: "Webhooks",
    id: "webhooks",
    description: "Real-time events for every state change — payment.completed, subscription.renewed, and more.",
  },
];

export default function PrimitivesSection() {
  return (
    <section className="border-border border-t px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <p className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-[1.6px] uppercase">
          Six primitives.
        </p>
        <h2 className="text-foreground mb-14 text-[clamp(26px,3vw,38px)] font-bold tracking-tight">
          Everything you need. Nothing you don&apos;t.
        </h2>

        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
          {primitives.map((p) => (
            <div
              key={p.id}
              className="border-border bg-background border p-6 first:rounded-tl-xl last:rounded-br-xl sm:first:rounded-tl-xl lg:first:rounded-tl-xl sm:[&:nth-child(2)]:rounded-tr-xl [&:nth-child(3)]:rounded-tr-xl lg:[&:nth-child(3)]:rounded-tr-xl [&:nth-child(4)]:rounded-bl-xl lg:[&:nth-child(4)]:rounded-bl-none lg:[&:nth-child(4)]:rounded-bl-xl sm:[&:nth-child(5)]:rounded-bl-xl sm:[&:nth-child(6)]:rounded-br-xl lg:[&:nth-child(6)]:rounded-br-xl"
            >
              <p className="text-foreground mb-2 font-semibold">{p.label}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
