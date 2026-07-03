import { deleteCheckout, putCheckout, retrieveCheckout } from "@/actions/checkout";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema, updateCheckoutSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ checkoutId: Schema.string() });
export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:checkouts",
  mcp: { name: "get_checkout", description: "Get a checkout" },
  schema: { params: paramsSchema },
  handler: async ({ params: { checkoutId }, auth: { organizationId, environment } }) => {
    const checkout = await retrieveCheckout(checkoutId, organizationId, environment);
    return Result.ok({ ...checkout, payment_url: `${process.env.NEXT_PUBLIC_CHECKOUT_URL}/${checkout.id}` });
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey"],
  mcp: { name: "update_checkout", description: "Update a checkout" },
  schema: { params: paramsSchema, body: updateCheckoutSchema },
  handler: async ({ params: { checkoutId }, auth: { organizationId, environment }, body }) => {
    const checkout = await putCheckout(checkoutId, body, organizationId, environment);
    return Result.ok(checkout);
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey"],
  mcp: { name: "delete_checkout", description: "Delete a checkout" },
  schema: { params: paramsSchema },
  handler: async ({ params: { checkoutId }, auth: { organizationId, environment } }) => {
    await deleteCheckout(checkoutId, organizationId, environment);
    return Result.ok(null);
  },
});
