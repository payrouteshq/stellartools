import { resolveAuthContext } from "@/actions/apikey";
import { postCheckout } from "@/actions/checkout";
import { upsertCustomer } from "@/actions/customers";
import { retrieveProducts } from "@/actions/product";
import { getCorsHeaders, subscriptionPeriodMs } from "@/constant";
import { AppError } from "@/lib/action-handler";
import { createOptionsHandler } from "@/lib/api-handler";
import { toSnakeCase } from "@/lib/utils";
import { Result, createCheckoutSchema, createDirectCheckoutSchema, validateSchema } from "@stellartools/core";
import moment from "moment";
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
        ? await Result.andThenAsync(validateSchema(createCheckoutSchema, body), (d) => processCheckout(d, "product"))
        : await Result.andThenAsync(validateSchema(createDirectCheckoutSchema, body), (d) =>
            processCheckout(d, "direct")
          );

    return result.isOk() ? send(toSnakeCase(result.value)) : send({ error: result.error.message }, 400);

    async function processCheckout(data: any, checkoutType: "product" | "direct") {
      const auth = await resolveAuthContext({ apiKey, sessionToken });
      if (!auth) {
        return Result.err(new AppError("Unauthorized"));
      }
      const { customer_id, customer_email, customer_phone, metadata } = data;
      console.log({ data });
      const customer = await upsertCustomer(
        { id: customer_id, email: customer_email, phone: customer_phone },
        auth.organizationId,
        auth.environment,
        { name: customer_email?.split("@")[0] ?? "Guest", metadata }
      );

      let subscriptionData = null;

      if ("product_id" in data) {
        const [product] = await retrieveProducts(auth.organizationId, auth.environment, data.product_id);

        if (!product) return Result.err(new AppError(`Product Not Found ${data.product_id}`));

        if (product.type == "subscription" && !product.recurringPeriod) {
          return Result.err(new AppError("Subscription product does not have a recurring period"));
        }

        const durationMs = subscriptionPeriodMs(product.recurringPeriod, product.customDurationMs);

        if (!durationMs && product.type === "subscription") {
          return Result.err(new AppError("Subscription product has an invalid billing period"));
        }

        subscriptionData = {
          period_start: moment().toISOString(),
          period_end: moment().add(durationMs, "milliseconds").toISOString(),
          cancel_at_period_end: false,
        };
      }

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
        subscriptionData,
        productId: checkoutType === "product" ? data.product_id : null,
        currencyCode: checkoutType === "direct" ? data.currency_code : null,
        amountCents: checkoutType === "direct" ? data.amount_cents : null,
      } as Parameters<typeof postCheckout>[0];

      const checkout = await postCheckout(payload as any, auth.organizationId, auth.environment);

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
