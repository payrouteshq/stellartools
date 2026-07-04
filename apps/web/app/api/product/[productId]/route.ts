import { deleteProduct, putProduct, retrieveProducts } from "@/actions/product";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { toCamelCase } from "@/lib/utils";
import { Result, z as Schema, updateProductSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ productId: Schema.string() });

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:products",
  schema: { params: paramsSchema },
  mcp: { name: "get_product", description: "Get a product by ID" },
  handler: async ({ params: { productId }, auth: { organizationId, environment } }) => {
    const [product] = await retrieveProducts(organizationId, environment, { productId });
    if (!product) return Result.err(new AppError("Product not found"));
    return Result.ok(product);
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey"],
  schema: { body: updateProductSchema, params: paramsSchema },
  mcp: { name: "update_product", description: "Update a product" },
  handler: async ({ body, auth: { organizationId, environment }, params: { productId } }) => {
    const product = await putProduct(
      productId,
      organizationId,
      environment,
      toCamelCase({
        ...body,
        ...(body?.name && { name: body.name }),
        ...(body?.description && { description: body.description }),
        ...(body?.images && { images: body.images }),
        ...(body?.metadata && { metadata: body.metadata }),
      })
    );
    return Result.ok(product);
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey"],
  schema: { params: paramsSchema },
  mcp: { name: "delete_product", description: "Delete a product" },
  handler: async ({ params: { productId }, auth: { organizationId } }) => {
    const product = await deleteProduct(productId, organizationId);
    return Result.ok(product);
  },
});
