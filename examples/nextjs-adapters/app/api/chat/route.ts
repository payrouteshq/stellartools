import { resolveCustomerIdFromEmail } from "@/lib/resolve-customer";
import { openai } from "@ai-sdk/openai";
import { ShieldError, shield } from "@stellartools/aisdk-adapter";
import { streamText } from "ai";

export async function POST(req: Request) {
  try {
    const { messages, customerEmail } = await req.json();

    if (!customerEmail) {
      return Response.json({ error: "Customer Email Not Found, Please Enter a Valid Email" }, { status: 400 });
    }

    const customerId = await resolveCustomerIdFromEmail(customerEmail);

    if (!customerId) {
      return Response.json({ error: "Customer Not Found", blocked: true }, { status: 400 });
    }

    const apiKey = process.env.STELLARTOOLS_API_KEY;
    const productId = process.env.STELLARTOOLS_PRODUCT_ID;

    if (!apiKey || !productId) {
      return Response.json({ error: "Missing API key or product ID" }, { status: 500 });
    }

    const model = shield(openai("gpt-4o-mini"), {
      apiKey,
      customerId,
      productId,
      cacheTTL: 60_000,
    });

    const result = streamText({ model, messages });
    return result.toTextStreamResponse();
  } catch (err: unknown) {
    if (err instanceof ShieldError) {
      return Response.json({ error: err.message, blocked: true }, { status: 403 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "An error occurred", blocked: false },
      { status: 500 }
    );
  }
}
