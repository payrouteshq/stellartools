import { deleteCheckout, putCheckout, retrieveCheckout } from "@/actions/checkout";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema, updateCheckoutSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ id: Schema.string() });
export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:checkouts",
  mcp: { name: "get_checkout", description: "Get a checkout" },
  schema: { params: paramsSchema },
  handler: async ({ params: { id }, auth: { organizationId, environment } }) => {
    const checkout = await retrieveCheckout(id, organizationId, environment);
    return Result.ok(checkout);
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:checkouts",
  mcp: { name: "update_checkout", description: "Update a checkout" },
  schema: { params: paramsSchema, body: updateCheckoutSchema },
  handler: async ({ params: { id }, auth: { organizationId, environment }, body }) => {
    const checkout = await putCheckout(id, body, organizationId, environment);
    return Result.ok(checkout);
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:checkouts",
  mcp: { name: "delete_checkout", description: "Delete a checkout" },
  schema: { params: paramsSchema },
  handler: async ({ params: { id }, auth: { organizationId, environment } }) => {
    await deleteCheckout(id, organizationId, environment);
    return Result.ok(null);
  },
});
