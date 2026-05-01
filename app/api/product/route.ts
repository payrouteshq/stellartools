import { postProduct } from "@/actions/product";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { xlmToStroops } from "@/lib/utils";
import { Result, createProductSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:products",
  schema: { body: createProductSchema },
  handler: async ({ body, auth: { organizationId, environment } }) => {
    console.log(body);

    const productData: Parameters<typeof postProduct>[0] = {
      name: body.name,
      description: body.description ?? null,
      images: body.images,
      type: body.type,
      assetCode: body.asset_code,
      status: "active" as const,
      metadata: body.metadata,
      priceAmount: xlmToStroops(body.price_amount.toString()),
      recurringPeriod: body.recurring_period ?? null,
      unit: body.unit ?? null,
      unitsPerCredit: body.units_per_credit ? BigInt(body.units_per_credit) : null,
      totalCredits: body.total_credits ? BigInt(body.total_credits) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const response = await postProduct(productData, organizationId, environment);

    return Result.ok(response);
  },
});
