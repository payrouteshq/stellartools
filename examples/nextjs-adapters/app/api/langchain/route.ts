import { resolveCustomerIdFromEmail } from "@/lib/resolve-customer";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ShieldError, shield } from "@stellartools/langchain-adapter";

export async function POST(req: Request) {
  try {
    const { message, customerEmail } = await req.json();

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

    const model = shield(new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.7 }), {
      apiKey,
      customerId,
      productId,
      cacheTTL: 120_000,
    });

    const result = await model.invoke([new HumanMessage(message)]);
    return Response.json({ content: result.content });
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
