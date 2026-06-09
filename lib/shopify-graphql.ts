const API_VERSION = "2026-04";

async function paymentsRequest(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ errors?: { message: string }[]; data?: Record<string, unknown> }> {
  const url = `https://${shop}/payments_apps/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export async function paymentSessionResolve(shop: string, accessToken: string, gid: string) {
  return paymentsRequest(shop, accessToken, PAYMENT_SESSION_RESOLVE, { id: gid });
}

export async function paymentSessionReject(shop: string, accessToken: string, gid: string) {
  return paymentsRequest(shop, accessToken, PAYMENT_SESSION_REJECT, {
    id: gid,
    reason: { code: "PROCESSING_ERROR", merchantMessage: "Payment could not be confirmed." },
  });
}

export async function refundSessionResolve(shop: string, accessToken: string, gid: string) {
  return paymentsRequest(shop, accessToken, REFUND_SESSION_RESOLVE, { id: gid });
}

export async function voidSessionResolve(shop: string, accessToken: string, gid: string) {
  return paymentsRequest(shop, accessToken, VOID_SESSION_RESOLVE, { id: gid });
}

const PAYMENT_SESSION_RESOLVE = `
  mutation PaymentSessionResolve($id: ID!) {
    paymentSessionResolve(id: $id) {
      paymentSession { id }
      userErrors { field message }
    }
  }
`;

const PAYMENT_SESSION_REJECT = `
  mutation PaymentSessionReject($id: ID!, $reason: PaymentSessionRejectionReasonInput!) {
    paymentSessionReject(id: $id, reason: $reason) {
      paymentSession { id }
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

const VOID_SESSION_RESOLVE = `
  mutation VoidSessionResolve($id: ID!) {
    voidSessionResolve(id: $id) {
      voidSession { id }
      userErrors { field message }
    }
  }
`;
