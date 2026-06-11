import crypto from "node:crypto";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

function verifyCallbackSig(secret: string, gid: string, shop: string, sig: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(`${gid}:${shop}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

const RESOLVE_MUTATION = `
  mutation paymentSessionResolve($id: ID!) {
    paymentSessionResolve(id: $id) {
      paymentSession {
        nextAction {
          context {
            ... on PaymentSessionActionsRedirect {
              redirectUrl
            }
          }
        }
      }
      userErrors {
        message
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const gid = url.searchParams.get("gid") ?? "";
  const shop = url.searchParams.get("shop") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  const internalSecret = process.env.INTERNAL_API_SECRET ?? "";
  const apiUrl = process.env.STELLAR_TOOLS_API_URL ?? "";

  const fallbackUrl = `https://${shop}/`;

  // Verify the callback signature
  if (!gid || !shop || !sig || !verifyCallbackSig(internalSecret, gid, shop, sig)) {
    return redirect(fallbackUrl);
  }

  // Fetch shop access token from main app
  let accessToken: string | null = null;
  try {
    const sessRes = await fetch(
      `${apiUrl}/shopify/sessions?shop=${encodeURIComponent(shop)}`,
      { headers: { Authorization: `Bearer ${internalSecret}` } }
    );
    if (sessRes.ok) {
      const sessions = (await sessRes.json()) as Array<{
        accessToken?: string;
        organizationId?: string | null;
      }>;
      const linked = sessions.find((s) => s.organizationId != null && s.accessToken);
      accessToken = linked?.accessToken ?? null;
    }
  } catch {
    // fall through
  }

  if (!accessToken) {
    return redirect(fallbackUrl);
  }

  // Call Shopify paymentSessionResolve mutation
  try {
    const gqlRes = await fetch(
      `https://${shop}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query: RESOLVE_MUTATION, variables: { id: gid } }),
      }
    );

    if (!gqlRes.ok) {
      return redirect(fallbackUrl);
    }

    const gqlData = (await gqlRes.json()) as {
      data?: {
        paymentSessionResolve?: {
          paymentSession?: {
            nextAction?: {
              context?: {
                redirectUrl?: string;
              };
            };
          };
          userErrors?: Array<{ message: string }>;
        };
      };
    };

    const redirectUrl =
      gqlData.data?.paymentSessionResolve?.paymentSession?.nextAction?.context?.redirectUrl;

    if (redirectUrl) {
      return redirect(redirectUrl);
    }

    return redirect(fallbackUrl);
  } catch {
    return redirect(fallbackUrl);
  }
};

export default function PaymentComplete() {
  return null;
}
