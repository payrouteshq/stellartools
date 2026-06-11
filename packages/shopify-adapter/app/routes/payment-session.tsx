import crypto from "node:crypto";
import type { ActionFunctionArgs } from "react-router";

function verifyShopifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

function buildCallbackSig(secret: string, id: string, shop: string): string {
  return crypto.createHmac("sha256", secret).update(`${id}:${shop}`).digest("hex");
}

async function rejectPaymentSession(
  shop: string,
  accessToken: string,
  gid: string,
  reason: string
): Promise<void> {
  await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query: `
        mutation paymentSessionReject($id: ID!, $reason: PaymentSessionRejectionReasonInput!) {
          paymentSessionReject(id: $id, reason: $reason) {
            paymentSession { id state }
            userErrors { message }
          }
        }
      `,
      variables: { id: gid, reason: { code: "PROCESSING_ERROR", merchantMessage: reason } },
    }),
  });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const shopifySecret = process.env.SHOPIFY_API_SECRET ?? "";
  const apiUrl = process.env.STELLAR_TOOLS_API_URL ?? "";
  const checkoutUrl = process.env.STELLAR_TOOLS_CHECKOUT_URL ?? "";
  const appUrl = process.env.SHOPIFY_APP_URL ?? "";
  const internalSecret = process.env.INTERNAL_API_SECRET ?? "";

  const rawBody = await request.text();
  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");

  // Verify Shopify HMAC signature
  if (!verifyShopifyHmac(rawBody, hmacHeader, shopifySecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: {
    id: string;
    amount: string;
    currency: string;
    shop: string;
    test: boolean;
    checkout_url: string;
    merchant_reference: string;
    kind: string;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { id, amount, currency: _currency, shop, merchant_reference } = payload;

  // Fetch org API key from main app
  let orgApiKey: string | null = null;
  let shopAccessToken: string | null = null;

  try {
    const keyRes = await fetch(`${apiUrl}/shopify/org-apikey?shop=${encodeURIComponent(shop)}`, {
      headers: { Authorization: `Bearer ${internalSecret}` },
    });
    if (keyRes.ok) {
      const keyData = (await keyRes.json()) as { apiKey?: string };
      orgApiKey = keyData.apiKey ?? null;
    }
  } catch {
    // fall through — orgApiKey stays null
  }

  // If shop is not connected, we need an access token to call the reject mutation.
  // Attempt to get one; if unavailable, return 200 with empty body as graceful fallback.
  if (!orgApiKey) {
    try {
      const sessRes = await fetch(`${apiUrl}/shopify/sessions?shop=${encodeURIComponent(shop)}`, {
        headers: { Authorization: `Bearer ${internalSecret}` },
      });
      if (sessRes.ok) {
        const sessions = (await sessRes.json()) as Array<{
          accessToken?: string;
          organizationId?: string | null;
        }>;
        const linked = sessions.find((s) => s.organizationId != null && s.accessToken);
        shopAccessToken = linked?.accessToken ?? sessions[0]?.accessToken ?? null;
      }
    } catch {
      // ignore
    }

    if (shopAccessToken) {
      await rejectPaymentSession(shop, shopAccessToken, id, "Shop not connected to StellarTools");
    }
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build signed callback URL
  const sig = buildCallbackSig(internalSecret, id, shop);
  const callbackUrl = `${appUrl}/payment-complete?gid=${encodeURIComponent(id)}&shop=${encodeURIComponent(shop)}&sig=${sig}`;

  // Create checkout on StellarTools
  try {
    const checkoutRes = await fetch(`${checkoutUrl}/api/checkout?type=direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": orgApiKey,
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        asset_code: "USDC",
        redirect_url: callbackUrl,
        metadata: {
          shopify_payment_session_gid: id,
          shopify_shop: shop,
          shopify_merchant_reference: merchant_reference,
        },
      }),
    });

    if (!checkoutRes.ok) {
      throw new Error(`Checkout creation failed: ${checkoutRes.status}`);
    }

    const checkoutData = (await checkoutRes.json()) as {
      data: { id: string; next_action: { redirect_to_url: { url: string } } };
    };

    const redirectUrl = checkoutData.data.next_action.redirect_to_url.url;

    return new Response(JSON.stringify({ redirect_url: redirectUrl }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // On any error: reject the payment session and return 200
    if (!shopAccessToken) {
      try {
        const sessRes = await fetch(`${apiUrl}/shopify/sessions?shop=${encodeURIComponent(shop)}`, {
          headers: { Authorization: `Bearer ${internalSecret}` },
        });
        if (sessRes.ok) {
          const sessions = (await sessRes.json()) as Array<{
            accessToken?: string;
            organizationId?: string | null;
          }>;
          const linked = sessions.find((s) => s.organizationId != null && s.accessToken);
          shopAccessToken = linked?.accessToken ?? sessions[0]?.accessToken ?? null;
        }
      } catch {
        // ignore
      }
    }

    if (shopAccessToken) {
      await rejectPaymentSession(shop, shopAccessToken, id, "Payment creation failed");
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
