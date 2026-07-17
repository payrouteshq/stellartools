import { openai } from "@ai-sdk/openai";
import { ShieldError, shield } from "@stellartools/aisdk-adapter";
import { streamText } from "ai";

export async function POST(req: Request) {
  const { messages, customerId } = await req.json();

  // shield() wraps the model — throws ShieldError before the LLM call if access is denied
  const model = shield(openai("gpt-4o-mini"), {
    apiKey: process.env.STELLAR_API_KEY!,
    customerId,
    productId: process.env.STELLAR_PRODUCT_ID!,
  });

  try {
    const result = streamText({ model, messages });
    return result.toDataStreamResponse();
  } catch (err: unknown) {
    if (err instanceof ShieldError) {
      return Response.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
