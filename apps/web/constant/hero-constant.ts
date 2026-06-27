const medusaJSCodeSample = /* ts */ `
import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  modules: [
    {
      resolve: "@medusajs/payment",
      options: {
        providers: [
          {
            resolve: "@stellartools/medusajs-adapter",
            id: "stellar",
            debug: true,
            webhook_secret: process.env.STELLAR_TOOLS_WEBHOOK_SECRET!,
          },
        ],
      },
    },
  ],
});
`;

const aiSdkCodeExample = /* ts */ `
import { createStellarToolsAISDK } from "@stellartools/aisdk-adapter";
import { openai } from "@ai-sdk/openai";

// Wraps AI SDK — access is gated by the customer's active subscription or payment
const ai = createStellarToolsAISDK({
  api_key: process.env.STELLAR_TOOLS_API_KEY!,
  customer_id: "cus_erkiopiokpikopo",
  product_id: "pr_jkwheihiuhcuihewe",
});

const result = await ai.generateText({
  model: openai("gpt-4o"),
  prompt: "Hello, how are you?",
});

export default result;
`;

const betterAuthCodeSample = /* ts */ `
import { betterAuth } from "better-auth"
import { stellarTools } from "@stellartools/betterauth-adapter";

export const auth = betterAuth({
  plugins: [
    stellarTools({
     api_key: process.env.STELLAR_TOOLS_API_KEY!,
     create_customer_on_sign_up: true,
     on_customer_created: async (customer) => {
      console.log("Customer created", customer);
    },
    on_checkout_complete: async (checkout) => {
      console.log("Checkout completed", checkout);
    },
    on_subscription_created: async (subscription) => {
      console.log("Subscription started", subscription);
    },
  }),
  ]
});

export default auth;`;

const UploadThingCodeSample = /* ts */ `
import { createStellarUploadthing } from "@stellartools/uploadthing-adapter"

// Verifies the customer has an active subscription or payment before uploading
const f = createStellarUploadthing({
  api_key: process.env.STELLAR_TOOLS_API_KEY!,
  product_id: "pr_jkwheihiuhcuihewe",
});

export const fileRouter = {
  image: f({ image: { maxFileSize: "8MB" } })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for customer:", metadata.customerId);
      console.log("File URL:", file.url);
    })
}
`;

export const Heroproviders = [
  {
    id: "aisdk",
    name: "AI SDK",
    logo: "/images/integrations/aisdk.jpg",
    filename: "lib/ai.ts",
    code: aiSdkCodeExample,
  },
  {
    id: "betterauth",
    name: "BetterAuth",
    logo: "/images/integrations/better-auth.png",
    filename: "lib/auth.ts",
    code: betterAuthCodeSample,
  },
  {
    id: "uploadthing",
    name: "UploadThing",
    logo: "/images/integrations/uploadthing.png",
    filename: "api/uploadthing/core.ts",
    code: UploadThingCodeSample,
  },
  {
    id: "medusa",
    name: "Medusa",
    logo: "/images/integrations/medusa.jpeg",
    filename: "medusa-config.ts",
    code: medusaJSCodeSample,
  },
];
