import { StellarTools } from "@stellartools/core";

export async function resolveCustomerIdFromEmail(email: string | undefined): Promise<string | null> {
  const trimmed = email?.trim();

  if (!trimmed) return null;

  const st = new StellarTools({ api_key: process.env.STELLARTOOLS_API_KEY! });

  const customers = await st.customers.list({ email: trimmed });

  return customers[0]?.id ?? "";
}
