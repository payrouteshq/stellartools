import { resolveAuthContext } from "@/actions/apikey";
import { postCheckout } from "@/actions/checkout";
import { upsertCustomer } from "@/actions/customers";
import { retrieveProducts } from "@/actions/product";
import { getCorsHeaders, subscriptionIntervals } from "@/constant";
import { createOptionsHandler } from "@/lib/api-handler";
import { Result, createCheckoutSchema, createDirectCheckoutSchema, validateSchema } from "@stellartools/core";
import moment from "moment";
import { NextRequest, NextResponse } from "next/server";

export const OPTIONS = createOptionsHandler();

export const POST = async (req: NextRequest) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const type = req.nextUrl.searchParams.get("type");

  const send = (data: any, status = 200) => NextResponse.json(data, { status, headers: corsHeaders });

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

    return result.isOk() ? send({ data: result.value }) : send({ error: result.error.message }, 400);

    async function processCheckout(data: any, checkoutType: "product" | "direct") {
      const auth = await resolveAuthContext({ apiKey, sessionToken });
      const { customer_id, customer_email, customer_phone, metadata } = data;
      const customer = await upsertCustomer(
        { id: customer_id, email: customer_email, phone: customer_phone },
        auth.organizationId,
        auth.environment,
        { name: customer_email?.split("@")[0] ?? "Guest", metadata }
      );

      let subscriptionData = null;

      if ("product_id" in data) {
        const [{ product }] = await retrieveProducts(auth.organizationId, auth.environment, data.product_id);

        if (!product) return Result.err(new Error(`Product Not Found ${data.product_id}`));

        if (product.type == "subscription" && !product.recurringPeriod) {
          return Result.err(new Error("Subscription product does not have a recurring period"));
        }

        const durationDays = subscriptionIntervals[product.recurringPeriod!];

        subscriptionData = {
          periodStart: moment().toISOString(),
          periodEnd: moment().add(durationDays, "days").toISOString(),
          cancelAtPeriodEnd: false,
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
        amount: checkoutType === "direct" ? data.amount : null,
        assetCode: checkoutType === "direct" ? data.asset_code : null,
      } as Parameters<typeof postCheckout>[0];

      const checkout = await postCheckout(payload as any, auth.organizationId, auth.environment);

      return Result.ok({
        ...checkout,
        next_action: {
          type: "redirect_to_url",
          redirect_to_url: {
            url: `${process.env.NEXT_PUBLIC_CHECKOUT_URL}/${checkout.id}`,
            return_url: checkout.redirectUrl,
          },
        },
      });
    }
  } catch (error) {
    console.error(error);
    return send({ error: "Failed to create checkout" }, 500);
  }
};
