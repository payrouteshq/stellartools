import { postCustomers, retrieveCustomers } from "@/actions/customers";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { apiListParamsSchema } from "@/types";
import { Result, z as Schema, createCustomerSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey"],
  schema: { body: Schema.array(createCustomerSchema) },
  mcp: { name: "create_customers", description: "Create one or more customers" },
  handler: async ({ body, auth: { organizationId, environment }, req }) => {
    const arrayBody = Array.isArray(body) ? body : [body];
    const source = req.headers.get("x-source") ?? "API";

    const response = await postCustomers(
      arrayBody.map((customer) => ({
        name: customer.name,
        email: customer.email,
        phone: customer.phone ?? null,
        image: customer.image ?? null,
        metadata: customer.metadata ?? null,
      })),
      organizationId,
      environment,
      { source }
    );

    return Result.ok(
      response.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone ?? undefined,
        image: c.image ?? null,
        metadata: c.metadata ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        wallets: [],
      }))
    );
  },
});

export const GET = apiHandler({
  auth: ["session", "apikey"],
  requiredAppScope: "read:customers",
  mcp: { name: "get_customers", description: "Get all customers for an organization" },
  schema: {
    query: apiListParamsSchema.extend({
      email: Schema.string().email().optional(),
      phone: Schema.string().optional(),
    }),
  },
  handler: async ({ query, auth: { organizationId, environment } }) => {
    const customers = await retrieveCustomers(
      {
        ...(query && "email" in query ? { email: query.email } : {}),
        ...(query && "phone" in query ? { phone: query.phone } : {}),
        ...(query.limit && { limit: query.limit }),
        ...(query.starting_after && { starting_after: query.starting_after }),
        ...(query.ending_before && { ending_before: query.ending_before }),
      },
      { withWallets: true },
      organizationId,
      environment
    );
    return Result.ok(
      customers.data.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        phone: c.phone ?? undefined,
        image: c.image ?? null,
        metadata: c.metadata ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        wallets: (c.wallets ?? []).map((w) => ({
          id: w.id,
          address: w.address,
          metadata: w.metadata ?? undefined,
          createdAt: w.createdAt,
        })),
      }))
    );
  },
});
