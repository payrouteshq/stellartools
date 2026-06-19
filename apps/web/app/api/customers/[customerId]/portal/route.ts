import { createCustomerPortalSession } from "@/actions/customers";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

const paramsSchema = Schema.object({ customerId: Schema.string() });

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey"],
  schema: { params: paramsSchema },
  handler: async ({ params: { customerId }, auth: { organizationId, environment } }) => {
    const { session, url } = await createCustomerPortalSession(customerId, organizationId, environment);
    return Result.ok({ url, token: session.token, expiresAt: session.expiresAt });
  },
});
