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
  mcp: { name: "update_product", description: "Update a product" },
  handler: async ({ body, auth: { organizationId, environment }, params: { id } }) => {
    const product = await putProduct(
      id,
      organizationId,
      environment,
      toCamelCase({
        ...body,
        unitsPerCredit: body.units_per_credit ? body.units_per_credit : null,
        totalCredits: body.total_credits ? body.total_credits : null,
        priceAmount: body.price_amount ? body.price_amount : undefined,
      })
    );
    return Result.ok(product);
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:products",
  schema: { params: paramsSchema },
  mcp: { name: "delete_product", description: "Delete a product" },
  handler: async ({ params: { id }, auth: { organizationId } }) => {
    const product = await deleteProduct(id, organizationId);
    return Result.ok(product);
  },
});
