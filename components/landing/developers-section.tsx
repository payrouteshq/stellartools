"use client";

import { CodeBlock } from "@/components/code-block";
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@/components/underline-tabs";

const examples = [
  {
    filename: "checkout.ts",
    code: `import { StellarTools } from '@stellartools/core';

const st = new StellarTools({
  apiKey: process.env.STELLAR_TOOLS_API_KEY,
});

// Create a customer
const customer = await st.customers.create({
  email: 'odii@stellartools.dev',
  name: 'Emmanuel Odii',
});

// Create a checkout session
const checkout = await st.checkout.create({
  customerId: customer.id,
  productId: 'prod_xxx',
  redirectUrl: 'https://yourapp.com/success',
});

redirect(checkout.paymentUrl);`,
  },
  {
    filename: "webhook.ts",
    code: `import { StellarTools } from '@stellartools/core';
import { NextRequest, NextResponse } from 'next/server';

const st = new StellarTools({ apiKey: process.env.STELLAR_TOOLS_API_KEY! });

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('x-stellartools-signature')!;

  const event = st.webhooks.constructEvent(
    body, sig, process.env.STELLAR_TOOLS_WEBHOOK_SECRET!
  );

  if (event.type === 'payment.completed') {
    const { customerId } = event.data.object;
    // Grant access — update your database, send a welcome email, etc.
    await grantAccess(customerId);
  }

  return NextResponse.json({ received: true });
}`,
  },
];

export default function DevelopersSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24" id="developers">
      <div className="grid items-start gap-14 md:grid-cols-[1fr,1.7fr]">
        <div>
          <p className="text-muted-foreground mb-4 text-[11px] font-semibold tracking-[1.6px] uppercase">
            For developers.
          </p>
          <h2 className="text-foreground mb-4 text-[clamp(28px,3.5vw,42px)] leading-[1.15] font-bold tracking-tight">
            A Stripe-like API you&apos;ll actually enjoy.
          </h2>
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            Familiar REST API and typed TypeScript SDK. Webhooks for every event. Full sandbox
            mode. If you&apos;ve integrated Stripe before, you&apos;ll feel right at home —
            except settlements take 3 seconds and cost fractions of a cent.
          </p>
        </div>

        <UnderlineTabs defaultValue={examples[0].filename}>
          <UnderlineTabsList>
            {examples.map((ex) => (
              <UnderlineTabsTrigger key={ex.filename} value={ex.filename} className="text-xs">
                {ex.filename}
              </UnderlineTabsTrigger>
            ))}
          </UnderlineTabsList>
          {examples.map((ex) => (
            <UnderlineTabsContent key={ex.filename} value={ex.filename} className="mt-0">
              <CodeBlock language="typescript" filename={ex.filename} showCopyButton>
                {ex.code}
              </CodeBlock>
            </UnderlineTabsContent>
          ))}
        </UnderlineTabs>
      </div>
    </section>
  );
}
