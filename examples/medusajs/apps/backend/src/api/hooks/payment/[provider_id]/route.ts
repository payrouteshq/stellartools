import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// Intentionally empty — Medusa's built-in /hooks/payment/[provider] route handles
// webhook ingestion and emits payment.webhook_received. Point the Stellartools
// webhook URL at /hooks/payment/stellar_stellar so Medusa constructs the correct
// provider ID: pp_${provider} = pp_stellar_stellar.
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.sendStatus(200);
};
