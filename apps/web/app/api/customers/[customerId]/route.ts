import { closeChannelOnChain, retrieveCreditBalances } from "@/actions/credit";
import { deleteCustomer, putCustomer, retrieveCustomers } from "@/actions/customers";
import { retrieveSubscriptions } from "@/actions/subscription";
import { cancelSubscription as cancelSorobanSubscription } from "@/integrations/soroban-contract";
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

    return Result.ok(customer);
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
    return Result.ok(customer);
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

    if (!customer) return Result.err(new AppError("Customer not found"));

    const [{ data: subscriptions }, { data: credits }] = await Promise.all([
      retrieveSubscriptions(
        auth.organizationId,
        auth.environment,
        {
          customerId: customer.id,
        },
        { withCustomerWallets: true, withCustomer: true }
      ),
      retrieveCreditBalances(auth.organizationId, auth.environment, { customerId: customer.id }),
    ]);

    for (const subscription of subscriptions) {
      const customerWallet = subscription.customerWallet;

      if (!customerWallet?.address) continue;

      const cancellationResult = await cancelSorobanSubscription(
        auth.environment,
        customerWallet.address,
        subscription.customerId,
        subscription.productId
      );

      if (cancellationResult.isErr()) return Result.err(new AppError(cancellationResult.error.message));
    }

    for (const credit of credits) {
      if (!credit.channelAddress) continue;
      await closeChannelOnChain(credit, auth.environment);
    }

    await deleteCustomer(params.customerId, auth.organizationId, auth.environment);

    return Result.ok(null);
  },
});
