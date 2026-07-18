import { deleteCustomer, putCustomer, retrieveCustomers } from "@/actions/customers";
import { retrieveSubscriptions } from "@/actions/subscription";
import {
  resolveMerchantSecret,
  cancelSubscription as soroban$cancelSubscription,
} from "@/integrations/soroban-contract";
import { AppError } from "@/lib/action-handler";
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

    return Result.ok({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone ?? undefined,
      image: customer.image ?? null,
      metadata: customer.metadata ?? null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      wallets: (customer.wallets ?? []).map((w) => ({
        id: w.id,
        address: w.address,
        metadata: w.metadata ?? undefined,
        createdAt: w.createdAt,
      })),
    });
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey", "portal"],
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
    return Result.ok({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone ?? undefined,
      image: customer.image ?? null,
      metadata: customer.metadata ?? null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      wallets: [],
    });
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey"],
  schema: { params: paramsSchema },
  mcp: { name: "delete_customer", description: "Delete a customer by ID" },
  handler: async ({ params, auth }) => {
    const {
      data: [customer],
    } = await retrieveCustomers(
      { id: params.customerId },
      { requireLookUpParams: true },
      auth.organizationId,
      auth.environment
    );

    if (!customer) return Result.err(new AppError("NOT_FOUND", "Customer not found"));

    const { data: subscriptions } = await retrieveSubscriptions(
      auth.organizationId,
      auth.environment,
      { customerId: customer.id },
      { withCustomerWallets: true, withCustomer: true }
    );

    for (const subscription of subscriptions) {
      const customerWallet = subscription.customerWallet;

      if (!customerWallet?.address) continue;

      const merchantSecret = await resolveMerchantSecret(auth.organizationId, auth.environment);
      const cancellationResult = await soroban$cancelSubscription(
        auth.environment,
        merchantSecret,
        customerWallet.address,
        subscription.productId
      );

      if (cancellationResult.isErr())
        return Result.err(new AppError("INTERNAL_ERROR", cancellationResult.error.message));
    }

    await deleteCustomer(params.customerId, auth.organizationId, auth.environment);

    return Result.ok(null);
  },
});
