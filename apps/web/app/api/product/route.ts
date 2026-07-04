import { postProduct, retrieveProducts } from "@/actions/product";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, createProductSchema, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:products",
  mcp: { name: "list_products", description: "List all products" },
  schema: { query: Schema.object({ status: Schema.string().optional() }) },
  handler: async ({ query, auth: { organizationId, environment } }) => {
    const productsList = await retrieveProducts(organizationId, environment, {
      ...(query.status && { status: query.status as any }),
    });
    return Result.ok(
      productsList.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? undefined,
        images: p.images ?? [],
        status: p.status,
        type: p.type,
        priceAmountCents: p.priceCents,
        recurringPeriod: p.recurringPeriod ?? undefined,
        customDurationMs: p.customDurationMs ?? undefined,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        metadata: p.metadata ?? {},
        environment: p.environment,
        unit: p.unit ?? undefined,
      }))
    );
  },
});

export const POST = apiHandler({
  auth: ["session", "apikey"],
  mcp: { name: "create_product", description: "Create a product" },
  schema: { body: createProductSchema },
  handler: async ({ body, auth: { organizationId, environment } }) => {
    const productData: Parameters<typeof postProduct>[0] = {
      name: body.name,
      description: body.description ?? null,
      images: body.images,
      type: body.type,
      status: "active" as const,
      metadata: body.metadata,
      priceCents: body.price_amount_cents,
      recurringPeriod: body.recurring_period ?? null,
      customDurationMs: body.custom_duration_ms ?? null,
      unit: body.unit ?? null,
      currencyCode: body.currency_code,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const response = await postProduct(productData, organizationId, environment);

    return Result.ok({
      id: response.id,
      name: response.name,
      description: response.description ?? undefined,
      images: response.images ?? [],
      status: response.status,
      type: response.type,
      priceAmountCents: response.priceCents,
      recurringPeriod: response.recurringPeriod ?? undefined,
      customDurationMs: response.customDurationMs ?? undefined,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
      metadata: response.metadata ?? {},
      environment: response.environment,
      unit: response.unit ?? undefined,
    });
  },
});
