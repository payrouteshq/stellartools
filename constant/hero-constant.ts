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
import { Server } from "@stellar/stellar-sdk";

const client = new Server("https://horizon-testnet.stellar.org");

export const auth = betterAuth({
  plugins: [
    stellarTools({ 
     api_key: process.env.STELLAR_TOOLS_API_KEY!,
     create_customer_on_sign_up: true, 
     credit_low_threshold: 10,
     on_customer_created: async (customer) => {
      console.log("Customer created", customer);
    },
    on_checkout_complete: async (checkout) => {
      console.log("Checkout completed", checkout);
    },
    on_credits_low: async (creditBalance) => {
      console.log("Credits low", creditBalance);
    }
  }),
  ]
});

export default auth;`;

const UploadThingCodeSample = /* ts */ `
import { createStellarUploadthing } from "@stellartools/uploadthing-adapter"

const f = createStellarUploadthing({
  api_key: process.env.STELLAR_TOOLS_API_KEY!,
  product_id: "pr_jkwheihiuhcuihewe",
});

export const fileRouter = {
  image: f({ image: { maxFileSize: "8MB" } }).
  .middleware(async ({ req }) => {
    return { userId: req.user.id }
  })
  .onUploadComplete(async ({ file }) => {
    // your logic here
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
