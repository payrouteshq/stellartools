/**
 * Client for Shopify's Payments Apps GraphQL API.
 * This API is separate from the Admin GraphQL API — different URL, same access token.
 * Used to resolve/reject payment and refund sessions, and to configure the app as ready.
 */

const PAYMENTS_API_VERSION = "2025-10";

function paymentsAppsUrl(shop: string) {
  return `https://${shop}/payments_apps/api/${PAYMENTS_API_VERSION}/graphql.json`;
}

async function gql(shop: string, accessToken: string, query: string, variables?: unknown) {
  const res = await fetch(paymentsAppsUrl(shop), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: Record<string, unknown>; errors?: unknown[] }>;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

const PAYMENT_SESSION_RESOLVE = `
  mutation PaymentSessionResolve($id: ID!) {
    paymentSessionResolve(id: $id) {
      paymentSession {
        id
        nextAction {
          action
          context { ... on PaymentSessionActionsRedirect { redirectUrl } }
        }
      }
      userErrors { field message }
    }
  }
`;

const PAYMENT_SESSION_REJECT = `
  mutation PaymentSessionReject($id: ID!, $reason: PaymentSessionRejectionReasonInput!) {
    paymentSessionReject(id: $id, reason: $reason) {
      paymentSession {
        id
        nextAction {
          action
          context { ... on PaymentSessionActionsRedirect { redirectUrl } }
        }
      }
      userErrors { field message }
    }
  }
`;

const REFUND_SESSION_RESOLVE = `
  mutation RefundSessionResolve($id: ID!) {
    refundSessionResolve(id: $id) {
      refundSession { id }
      userErrors { field message }
    }
  }
`;

const REFUND_SESSION_REJECT = `
  mutation RefundSessionReject($id: ID!, $reason: RefundSessionRejectionReasonInput!) {
    refundSessionReject(id: $id, reason: $reason) {
      refundSession { id }
      userErrors { field message }
    }
  }
`;

const PAYMENTS_APP_CONFIGURE = `
  mutation PaymentsAppConfigure($externalHandle: String, $ready: Boolean!) {
    paymentsAppConfigure(externalHandle: $externalHandle, ready: $ready) {
      userErrors { field message }
    }
  }
`;

// ─── Exported helpers ────────────────────────────────────────────────────────

/** Returns the redirectUrl Shopify wants to send the customer to next. */
export async function resolvePaymentSession(shop: string, accessToken: string, gid: string): Promise<string | null> {
  const res = await gql(shop, accessToken, PAYMENT_SESSION_RESOLVE, { id: gid });
  const session = (res.data?.paymentSessionResolve as any)?.paymentSession;
  return session?.nextAction?.context?.redirectUrl ?? null;
}

export async function rejectPaymentSession(
  shop: string,
  accessToken: string,
  gid: string,
  merchantMessage = "Payment could not be completed"
): Promise<string | null> {
  const res = await gql(shop, accessToken, PAYMENT_SESSION_REJECT, {
    id: gid,
    reason: { code: "PROCESSING_ERROR", merchantMessage },
  });
  const session = (res.data?.paymentSessionReject as any)?.paymentSession;
  return session?.nextAction?.context?.redirectUrl ?? null;
}

export async function resolveRefundSession(shop: string, accessToken: string, gid: string): Promise<void> {
  await gql(shop, accessToken, REFUND_SESSION_RESOLVE, { id: gid });
}

export async function rejectRefundSession(
  shop: string,
  accessToken: string,
  gid: string,
  merchantMessage = "Refund could not be processed"
): Promise<void> {
  await gql(shop, accessToken, REFUND_SESSION_REJECT, {
    id: gid,
    reason: { code: "PROCESSING_ERROR", merchantMessage },
  });
}

/** Mark the payment extension as ready to accept payments. Call after merchant saves API key. */
export async function configurePaymentsApp(shop: string, accessToken: string): Promise<void> {
  await gql(shop, accessToken, PAYMENTS_APP_CONFIGURE, {
    externalHandle: shop,
    ready: true,
  });
}
