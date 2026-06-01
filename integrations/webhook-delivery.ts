import "server-only";

import { postWebhookLog } from "@/actions/webhook";
import { Webhook as WebhookSchema } from "@/db/schema";
import { AppError } from "@/lib/error-handler";
import { ApiClient, WebhookEvent, WebhookEventType, WebhookSigner } from "@stellartools/core";

export const deliverWebhook = async (
  webhook: WebhookSchema,
  eventType: WebhookEventType,
  payload: WebhookEvent,
  logId: string
) => {
  const startTime = Date.now();

  const webhookPayload = {
    id: logId,
    object: "event",
    type: eventType,
    created: Math.floor(Date.now() / 1000),
    data: payload,
  };

  const signature = new WebhookSigner().generateSignature(JSON.stringify(webhookPayload), webhook.secret);

  const url = new URL(webhook.url);

  const client = new ApiClient({
    baseUrl: url.origin.replace(/\/$/, ""),
    headers: {
      "X-StellarTools-Signature": signature,
      "X-StellarTools-Event": eventType,
      "User-Agent": "StellarTools-Webhooks/1.0",
    },
    maxRetries: 0,
  });

  const result = await client.postDetailed<Record<string, unknown>>(
    url.pathname.slice(1) || "",
    JSON.stringify(webhookPayload)
  );

  const duration = Date.now() - startTime;

  let statusCode: number | null = null;
  let responseData: unknown = null;
  let isSuccess = false;
  let errorMessage: string | null = null;

  if (result.isOk()) {
    statusCode = result.value.status;
    responseData = result.value;
    isSuccess = result.value.ok;
    if (!isSuccess) errorMessage = `Server returned ${statusCode}`;
  } else {
    console.log({ result });
    errorMessage = result.error.message;
  }

  await postWebhookLog(
    webhook.id,
    {
      id: logId,
      eventType,
      request: webhookPayload,
      statusCode,
      errorMessage,
      responseTime: duration,
      response: responseData as Record<string, unknown> | null,
      description: `Delivery to ${webhook.url}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRetry: null,
      apiVersion: "2025-12-27.stellartools",
      appInstallationId: null,
    },
    webhook.organizationId,
    webhook.environment
  );

  if (!isSuccess) {
    console.error(`✗ Webhook failed: ${webhook.url} (${statusCode})`);
    if (result.isErr()) console.log(result.error.message);
    throw new AppError(errorMessage ?? "Delivery failed");
  }

  console.log(`✓ Webhook delivered: ${webhook.url} in ${duration}ms`);

  return { success: true };
};
