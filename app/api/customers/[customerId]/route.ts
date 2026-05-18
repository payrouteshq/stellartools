import { deleteCustomer, putCustomer, retrieveCustomers } from "@/actions/customers";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema, updateCustomerSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ customerId: Schema.string() });

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:customers",
  schema: { params: paramsSchema },
  mcp: { name: "get_customer", description: "Get a customer by ID" },
  handler: async ({ params, auth }) => {
    const {
      data: [customer],
    } = await retrieveCustomers(
      { id: params.customerId },
      { withWallets: true, requireLookUpParams: true },
      auth.organizationId,
      auth.environment
    );

    return Result.ok(customer);
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey", "portal", "app"],
  requiredAppScope: "write:customers",
  schema: {
    params: paramsSchema,
    body: updateCustomerSchema,
  },
  mcp: { name: "update_customer", description: "Update a customer by ID" },
  handler: async ({ params, body, auth, req }) => {
    const source = req.headers.get("x-source");
    const customer = await putCustomer(params.customerId, body, auth.organizationId, auth.environment, {
      ...(source && { source }),
    });
    return Result.ok(customer);
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:customers",
  schema: { params: paramsSchema },
  mcp: { name: "delete_customer", description: "Delete a customer by ID" },
  handler: async ({ params, auth }) => {
    await deleteCustomer(params.customerId, auth.organizationId, auth.environment);
    return Result.ok(null);
  },
});
