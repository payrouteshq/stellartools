import { cancelSchedule, createSchedule, getCredentialsByGhlSecret, resolvePaymentId } from "@/app/actions/db";
import { handleGhlQuery } from "@/lib/ghl";
import { HandlerError, StellarTools, routeHandler, z } from "@stellartools/core";

export const POST = routeHandler(
  async (_req, { body }) => {
    const apiKey = typeof body === "object" && body && "apiKey" in body ? String((body as { apiKey: unknown }).apiKey) : null;
    if (!apiKey) throw new HandlerError("Missing apiKey", 400);

    const credentials = await getCredentialsByGhlSecret(apiKey);
    if (!credentials) throw new HandlerError("Unknown apiKey", 401);

    try {
      return await handleGhlQuery(body, credentials.ghlSecret, {
        stellar: new StellarTools({ api_key: credentials.stellarApiKey }),
        resolvePaymentId,
        createSubscriptionSchedule: async (input) => {
          const nextChargeAt = new Date(Date.now() + input.intervalDays * 24 * 60 * 60 * 1000);
          await createSchedule({ ...input, locationId: credentials.locationId, environment: credentials.environment, nextChargeAt });
          return { status: "scheduled", nextChargeAt };
        },
        cancelSubscriptionSchedule: cancelSchedule,
      });
    } catch (err) {
      console.error("[ghl/query] failed:", err);
      return { success: false, message: "Request could not be processed" };
    }
  },
  { schema: z.record(z.string(), z.any()) }
);
