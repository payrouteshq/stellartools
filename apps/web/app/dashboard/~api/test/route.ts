import { sweepAndProcessPayment } from "@/actions/payment";
import { apiHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

export const GET = apiHandler({
  auth: ["apikey"],
  handler: async ({ auth: { organizationId, environment } }) => {
    const checkoutId = "cz_EFA830XU4NVJtGwM0o5lJjO3";
    await sweepAndProcessPayment(checkoutId);
    return Result.ok("Payment processed");
  },
});
