import { createMeteredPlugin } from "@stellartools/plugin-sdk";
import { NextRequest, NextResponse } from "next/server";

// Initialize the plugin with Sarah's API key
const billing = createMeteredPlugin({
  api_key: process.env.STELLAR_TOOLS_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { customerId, textToProcess } = await req.json();
  const PRODUCT_ID = "prod_saffron_summarizer"; // The ID from Step 1

  try {
    /**
     *
     * 1. preflight: Hits /sync to get managed keys and checks on-chain balance.
     * 2. execute: Runs the actual AI logic.
     * 3. getUsage: Calculates how much John used.
     * 4. charge: Signs the cryptographic voucher and saves it to ST.
     */
    const result = await billing.meter(
      customerId,
      PRODUCT_ID,
      async () => {
        // --- MOCK SERVICE LOGIC ---
        // Simulate a delay for "AI processing"
        await new Promise((r) => setTimeout(r, 800));

        const summary = textToProcess.substring(0, 50) + "... [Summarized]";
        const wordCount = textToProcess.split(" ").length;

        return {
          summary,
          tokensUsed: Math.ceil(wordCount * 1.5), // Example token math
        };
      },
      (res) => res.tokensUsed // We charge 1 credit per token
    );

    return NextResponse.json({
      data: result.summary,
      usage: result.tokensUsed,
    });
  } catch (err: any) {
    // If John's on-chain vault is empty, this catches the InsufficientCreditsError
    return NextResponse.json({ error: err.message }, { status: 402 });
  }
}
