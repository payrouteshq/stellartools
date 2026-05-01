"use client";

import React from "react";

import { CodeBlock } from "@/components/code-block";
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@/components/underline-tabs";
import { FlaskConical, Key, Webhook } from "lucide-react";

const features = [
  {
    icon: Key,
    title: "REST API + TypeScript SDK",
    description:
      "Everything is typed, documented, and consistent. Create customers, products, invoices, subscriptions with a single function call.",
  },
  {
    icon: Webhook,
    title: "Webhooks for every event",
    description:
      "payment.completed, subscription.renewed, refund.issued — subscribe to what matters and build reactive systems.",
  },
  {
    icon: FlaskConical,
    title: "Full sandbox / testnet mode",
    description:
      "Test everything on Stellar Testnet without touching real funds. Toggle production with a single env variable.",
  },
];

const codeExamples = [
  {
    filename: "create-checkout-session.ts",
    code: `import { StellarTools } from '@stellartools/core';

const st = new StellarTools({
  apiKey: process.env.STELLAR_TOOLS_API_KEY,
});

// Create a customer
const customer = await st.customers.create({
  email: 'odii@stellartools.dev',
  name: 'Emmanuel Odii',
  phone: '+2348123456789',
});

const checkout = await st.checkout.create({
  customerId: customer.id,
  productId: 'prod_xxx',
  redirectUrl: 'https://yourapp.com/success',
});

// → ${process.env.NEXT_PUBLIC_CHECKOUT_URL}/checkout/xxx
redirect(checkout.paymentUrl);`,
  },
  {
    filename: "webhook/route.ts",
    code: /**ts */ `import { StellarTools } from '@stellartools/core';
import { NextRequest, NextResponse } from "next/server";

const client = new StellarTools({ 
  apiKey: process.env.STELLARTOOLS_API_KEY!,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("X-StellarTools-Signature")!;

  const event = client.webhooks.constructEvent(body, signature, process.env.STELLARTOOLS_WEBHOOK_SECRET!);

  if (event.type === "customer.created") {
    const customer = event.data.object;
    console.dir(customer, { depth: 100 });
  } else {
    console.dir(event, { depth: 100 });
  }
      
  return NextResponse.json({ received: true });
}
    `,
  },
  {
    filename: "ai.ts",
    code: `import { generateText } from '@stellartools/aisdk-adapter';
import { openai } from "@ai-sdk/openai";

const response = await generateText({
  apiKey: process.env.STELLAR_TOOLS_API_KEY!,
  productId: "prod_llm_ai",
  customerId: "cust_xxx",
  model: openai("gpt-4o"),
  prompt: "Write a haiku about Stellar"
});

console.log(response);
`,
  },
];

export default function DevelopersSection() {
  return (
    <section className="bg-primary-foreground px-6 py-24 sm:px-10" id="developers">
      <div className="mx-auto grid max-w-[1200px] items-start gap-12 md:grid-cols-2 md:gap-20">
        <div>
          <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">For Developers</div>
          <h2 className="mb-5 text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight text-white">
            A Stripe-like API you&apos;ll
            <br />
            <em className="text-primary italic">actually enjoy.</em>
          </h2>
          <p className="mb-12 text-[17px] leading-relaxed text-white/55">
            Familiar REST API, typed JS SDK, webhooks, and sandbox mode. If you&apos;ve ever integrated Stripe,
            you&apos;ll feel right at home — except payments settle in 3 seconds for fractions of a cent.
          </p>

          <div className="flex flex-col gap-7">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-[10px] bg-white/6">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="mb-1.5 text-[15px] font-semibold text-white">{feature.title}</div>
                  <div className="text-[13.5px] leading-relaxed text-white/50">{feature.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <UnderlineTabs defaultValue={codeExamples[0].filename}>
          <UnderlineTabsList className="border-white/10">
            {codeExamples.map((example) => (
              <UnderlineTabsTrigger key={example.filename} value={example.filename} className="text-xs text-white/50">
                {example.filename}
              </UnderlineTabsTrigger>
            ))}
          </UnderlineTabsList>
          {codeExamples.map((example) => (
            <UnderlineTabsContent key={example.filename} value={example.filename} className="mt-0">
              <CodeBlock language="typescript" filename={example.filename} showCopyButton theme="dark">
                {example.code}
              </CodeBlock>
            </UnderlineTabsContent>
          ))}
        </UnderlineTabs>
      </div>
    </section>
  );
}
