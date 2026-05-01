import { deleteProduct, putProduct } from "@/actions/product";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { toCamelCase } from "@/lib/utils";
import { Result, z as Schema, updateProductSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ id: Schema.string() });

export const PUT = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:products",
  schema: { body: updateProductSchema, params: paramsSchema },
  handler: async ({ body, auth: { organizationId }, params: { id } }) => {
    const product = await putProduct(
      id,
      organizationId,
      toCamelCase({
        ...body,
        unitsPerCredit: body.units_per_credit ? BigInt(body.units_per_credit.toString()) : null,
        totalCredits: body.total_credits ? BigInt(body.total_credits.toString()) : null,
        priceAmount: body.price_amount ? BigInt(body.price_amount.toString()) : undefined,
      })
    );
    return Result.ok(product);
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:products",
  schema: { params: paramsSchema },
  handler: async ({ params: { id }, auth: { organizationId } }) => {
    const product = await deleteProduct(id, organizationId);
    return Result.ok(product);
  },
});
