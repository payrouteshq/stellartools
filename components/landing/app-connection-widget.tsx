"use client";

import { CodeBlock } from "@/components/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const integrations = [
  {
    id: "langchain",
    name: "LangChain",
    logo: "/images/integrations/langchain.png",
    filename: "langchain-billing.ts",
    /* ts */
    code: `import { createMeteredModel } from "@stellartools/langchain-adapter";
import { ChatOpenAI } from "@langchain/openai";

const model = createMeteredModel({
  apiKey: process.env.STELLAR_TOOLS_API_KEY,
  productId: "prod_llm_metered",
}, new ChatOpenAI({ model: "gpt-4o" }));

// Use like any LangChain model; pass customerId in options
const customerId = "cust_xxx";
const result = await model.invoke(customerId, [{ role: "user", content: "Hello" }]);
console.log(result);`,
  },

  {
    id: "ai-sdk",
    name: "AI SDK",
    logo: "/images/integrations/aisdk.jpg",
    filename: "index.ts",
    /* ts */
    code: `import { createMeteredAISDK } from "@stellartools/aisdk-adapter";
import { openai } from "@ai-sdk/openai";

const response = await generateText({
  apiKey: process.env.STELLAR_TOOLS_API_KEY!,
  productId: "prod_llm_ai",
  customerId: "cust_xxx",
  model: openai("gpt-4o"),
  prompt: "Write a haiku about Stellar"
});

console.log(response);`,
  },

  {
    id: "medusa",
    name: "MedusaJS",
    logo: "/images/integrations/medusa.svg",
    filename: "medusa-config.ts",
    /* ts */
    code: `import { loadEnv, defineConfig } from "@medusajs/framework/utils";
import { StellarTools } from "@stellartools/medusajs-adapter";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
  },
  modules: [
    {
      resolve: "@medusajs/payment",
      options: {
        providers: [
          {
            resolve: "@stellartools/medusajs-adapter",
            id: "stellar",
            options: {
              apiKey: process.env.STELLAR_TOOLS_API_KEY,
              webhookSecret: process.env.STELLAR_TOOLS_WEBHOOK_SECRET,
              debug: true,
            },
          },
        ],
      },
    },
  ],
});
`,
  },

  {
    id: "better-auth",
    name: "BetterAuth",
    logo: "/images/integrations/better-auth.png",
    filename: "lib/auth.ts",
    /* ts */
    code: `import { stellarTools } from "@stellartools/betterauth-adapter";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  plugins: [
    stellarTools({
      apiKey: process.env.STELLAR_API_KEY,
      createCustomerOnSignUp: true, 
      creditLowThreshold: 100,
      onCustomerCreated: async (customer) => {
        console.log("Customer created", customer);
      },
      onSubscriptionCreated: async (subscription) => {
        console.log("Subscription created", subscription);
      },
      onSubscriptionCanceled: async (subscription) => {
        console.log("Subscription canceled", subscription);
      },
      onCreditsLow: async (creditBalance) => {
        console.log("Credits low", creditBalance);
      },
    })
  ]
});`,
  },
];

export function AppConnectionWidget() {
  const router = useRouter();

  return (
    <section className="bg-card px-6 py-24 sm:px-10" id="integrations">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-16 text-center">
          <div className="text-primary mb-4 text-[12.5px] font-bold tracking-[1.2px] uppercase">Integrations</div>
          <h2 className="text-foreground mx-auto mb-5 text-[clamp(34px,4vw,50px)] leading-[1.15] font-bold tracking-tight">
            Drops right into your
            <br />
            <em className="text-primary italic">favorite stack.</em>
          </h2>
          <p className="text-muted-foreground mx-auto max-w-xl text-[17px] leading-relaxed">
            We built native adapters so you don&apos;t have to. Whether you&apos;re charging per AI token, building with
            Medusa, or just need auth-aware billing, there&apos;s a plug-and-play integration for that.
          </p>
        </div>

        <Tabs defaultValue={integrations[0].id} className="w-full">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="bg-secondary w-full flex-col sm:w-auto sm:flex-row sm:justify-start">
              {integrations.map((integration) => (
                <TabsTrigger
                  key={integration.id}
                  value={integration.id}
                  className="w-full justify-start gap-2 data-[state=active]:shadow-none sm:w-auto sm:justify-center"
                >
                  <Image
                    src={integration.logo}
                    alt={`${integration.name} logo`}
                    width={16}
                    height={16}
                    className="size-4 rounded-full object-contain"
                  />
                  <span>{integration.name}</span>
                </TabsTrigger>
              ))}
              <Link
                prefetch
                href="/book-call"
                className="text-foreground dark:text-muted-foreground hover:bg-background relative z-10 inline-flex h-[calc(100%-1px)] w-full items-center justify-start gap-2 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors sm:w-auto sm:justify-center"
              >
                <Plus className="size-4" />
                <span>Request</span>
              </Link>
            </TabsList>
            <span className="text-muted-foreground text-center text-sm whitespace-nowrap sm:text-left">
              + many more
            </span>
          </div>

          {integrations.map((integration) => (
            <TabsContent key={integration.id} value={integration.id} className="mt-0 w-full">
              <div className="mx-2 sm:mx-0">
                <CodeBlock language="typescript" filename={integration.filename} logo={integration.logo} showCopyButton>
                  {integration.code}
                </CodeBlock>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-12 text-center">
          <a
            href="/docs/integrations"
            className="bg-primary text-primary-foreground inline-block rounded-[9px] px-5 py-2.5 text-[14.5px] font-semibold no-underline transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(91,79,255,0.35)]"
          >
            Browse all integrations →
          </a>
        </div>
      </div>
    </section>
  );
}
