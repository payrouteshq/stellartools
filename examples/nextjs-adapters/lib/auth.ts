import { stellarTools } from "@stellartools/betterauth-adapter";
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  database: new Pool({
    connectionString: process.env.BETTER_AUTH_DATABASE_URL,
  }),
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
