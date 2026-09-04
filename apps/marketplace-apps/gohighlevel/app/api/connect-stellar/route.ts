import { connectStellarAccount } from "@/app/actions/stellar";
import { HandlerError, Network, routeHandler, z } from "@stellartools/core";

export const POST = routeHandler(
  async (req, { body }) => {
    if (req.headers.get("x-internal-secret") !== process.env.GHL_INTERNAL_API_SECRET) {
      throw new HandlerError("Unauthorized", 401);
    }

    const environment: Network | undefined =
      body.environment ?? (body.mode ? (body.mode === "live" ? "mainnet" : "testnet") : undefined);

    const result = await connectStellarAccount(body.locationId, environment, body.apiKey);
    if (result !== true) throw new HandlerError(result, 400);

    return { ok: true };
  },
  {
    schema: z.object({
      locationId: z.string(),
      environment: z.enum(["testnet", "mainnet"]).optional(),
      mode: z.enum(["test", "live"]).optional(),
      apiKey: z.string(),
    }),
  }
);
