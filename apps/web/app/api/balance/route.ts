import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrieveAccount } from "@/integrations/stellar-core";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["session", "apikey"],
  mcp: { name: "get_balance", description: "Fetch Account balance" },
  handler: async ({ auth: { organizationId, environment } }) => {
    const { secret } = await retrieveOrganizationIdAndSecret(organizationId, environment);

    if (!secret?.publicKey) return Result.ok([]);

    const accountResult = await retrieveAccount(secret.publicKey, environment);

    if (accountResult.isErr()) return Result.ok([]);

    return Result.ok({ value: accountResult.value!.balances, network: environment });
  },
});
