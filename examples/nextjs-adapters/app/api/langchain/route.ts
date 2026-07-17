import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ShieldError, shield } from "@stellartools/langchain-adapter";

export async function POST(req: Request) {
  const { message, customerId, free } = await req.json();

  const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.7 });

  // First message is free — bypass shield to demonstrate the open call
  if (free) {
    const result = await model.invoke([new HumanMessage(message)]);
    return Response.json({ content: result.content });
  }

  const shielded = shield(model, {
    apiKey: process.env.STELLAR_API_KEY!,
    customerId,
    productId: process.env.STELLAR_PRODUCT_ID!,
  });

  try {
    const result = await shielded.invoke([new HumanMessage(message)]);
    return Response.json({ content: result.content });
  } catch (err) {
    if (err instanceof ShieldError) {
      return Response.json({ error: err.message, blocked: true }, { status: 403 });
    }
    throw err;
  }
}
