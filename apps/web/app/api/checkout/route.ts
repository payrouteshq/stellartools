import { resolveAuthContext } from "@/actions/apikey";
import { createProductCheckoutSession, postCheckout } from "@/actions/checkout";
import { upsertCustomer } from "@/actions/customers";
import { getCorsHeaders } from "@/constant";
import { AppError } from "@/lib/action-handler";
import { createOptionsHandler } from "@/lib/api-handler";
import { toSnakeCase } from "@/lib/utils";
import {
  CreateCheckoutSchema_2026_08_18,
  CreateDirectCheckoutSchema_2026_08_18,
  Result,
  validateSchema,
} from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";

export const OPTIONS = createOptionsHandler();

export const POST = async (req: NextRequest) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const type = req.nextUrl.searchParams.get("type");

  const send = (data: any, status = 200) => {
    const body = JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    return new NextResponse(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  };

  try {
    if (type !== "product" && type !== "direct") {
      return send({ error: "Valid type (product|direct) is required" }, 400);
    }

    const apiKey = req.headers.get("x-api-key");
    const sessionToken = req.headers.get("x-session-token");

    if (!apiKey && !sessionToken) {
      return send({ error: "API key or Auth Token is required" }, 400);
    }

    const body = await req.json();

    const result =
      type === "product"
        ? await Result.andThenAsync(validateSchema(CreateCheckoutSchema_2026_08_18, body), (d) =>
            processCheckout(d, "product")
          )
        : await Result.andThenAsync(validateSchema(CreateDirectCheckoutSchema_2026_08_18, body), (d) =>
            processCheckout(d, "direct")
          );

    if (result.isErr()) {
      const err = result.error;
      const code = (err as AppError).code ?? "ERROR";
      const status = (err as AppError).status ?? 400;
      return send({ error: { code, message: err.message } }, status);
    }
    return send(toSnakeCase(result.value));

    async function processCheckout(data: any, checkoutType: "product" | "direct") {
      const auth = await resolveAuthContext({ apiKey, sessionToken });
      if (!auth) {
        return Result.err(new AppError("UNAUTHORIZED", "Unauthorized"));
      }

      let checkout;

      if (checkoutType === "product") {
        try {
          checkout = await createProductCheckoutSession({
            productId: data.product_id,
            orgId: auth.organizationId,
            env: auth.environment,
            customer: { id: data.customer_id, email: data.customer_email, phone: data.customer_phone },
            subscription: data.subscription_data
              ? {
                  trialDays: data.subscription_data.trial_days,
                  cancelAtPeriodEnd: data.subscription_data.cancel_at_period_end,
                }
              : null,
            metadata: data.metadata ?? {},
            description: data.description ?? null,
            redirectUrl: data.redirect_url ?? null,
          });
        } catch (e) {
          return Result.err(e instanceof AppError ? e : new AppError("INTERNAL_ERROR", "Failed to create checkout"));
        }
      } else {
        const { customer_id, customer_email, customer_phone, metadata } = data;
        const customer = await upsertCustomer(
          { id: customer_id, email: customer_email, phone: customer_phone },
          auth.organizationId,
          auth.environment,
          { name: customer_email?.split("@")[0] ?? "Guest", metadata }
        );

        const payload = {
          organizationId: auth.organizationId,
          environment: auth.environment,
          customerId: customer.id,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          status: "open" as const,
          expiresAt: new Date(Date.now() + 864e5),
          metadata: data.metadata ?? {},
          description: data.description ?? null,
          redirectUrl: data.redirect_url ?? null,
          subscriptionData: null,
          productId: null,
          currencyCode: data.currency_code,
          amountCents: data.amount_cents,
        } as Parameters<typeof postCheckout>[0];

        checkout = await postCheckout(payload as any, auth.organizationId, auth.environment);
      }

      return Result.ok({
        id: checkout.id,
        customerId: checkout.customerId,
        productId: checkout.productId ?? undefined,
        amountCents: checkout.amountCents ?? undefined,
        currencyCode: checkout.currencyCode ?? undefined,
        description: checkout.description ?? undefined,
        status: checkout.status,
        paymentUrl: `${process.env.NEXT_PUBLIC_CHECKOUT_URL}/${checkout.id}`,
        expiresAt: checkout.expiresAt,
        createdAt: checkout.createdAt,
        updatedAt: checkout.updatedAt,
        metadata: checkout.metadata ?? {},
        environment: checkout.environment,
        redirectUrl: checkout.redirectUrl ?? undefined,
        subscriptionData: checkout.subscriptionData ?? undefined,
      });
    }
  } catch (error) {
    console.error(error);
    return send({ error: "Failed to create checkout" }, 500);
  }
};
