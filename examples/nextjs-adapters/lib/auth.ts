import { stellarTools } from "@stellartools/betterauth-adapter";
import { betterAuth } from "better-auth";
import { DatabaseSync } from "node:sqlite";

export const auth = betterAuth({
  database: new DatabaseSync("auth.db"),
  emailAndPassword: { enabled: true },
  plugins: [
    stellarTools({
      apiKey: process.env.STELLARTOOLS_API_KEY!,
      createCustomerOnSignUp: true,
      onCustomerCreated: async (customer) => {
        console.log("[betterauth-adapter] customer created:", customer.id);
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
