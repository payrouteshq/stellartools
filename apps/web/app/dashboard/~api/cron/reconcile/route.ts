import { healGhostPayments } from "@/actions/reconciliation";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";
import { waitUntil } from "@vercel/functions";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session"],
  handler: async ({ auth: { organizationId, environment } }) => {
    waitUntil(Promise.all([healGhostPayments(organizationId, environment)]));
    return Result.ok({ ok: true });
  },
});
