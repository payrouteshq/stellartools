import "server-only";

import { postDeliveryLog } from "@/actions/webhook";
import { Webhook as WebhookSchema } from "@/db/schema";
import { AppError } from "@/lib/action-handler";
import { ApiClient, LATEST_VERSION, WebhookEventBase, WebhookEventType, WebhookSigner } from "@stellartools/core";

export const deliverWebhook = async <TName extends string, TObject>(
  webhook: WebhookSchema,
  eventType: WebhookEventType,
  payload: WebhookEventBase<TName, TObject>,
  logId: string
) => {
  const startTime = Date.now();

  const body = JSON.stringify(payload);
  const signature = new WebhookSigner().generateSignature(body, webhook.secret);

  const url = new URL(webhook.url);
  const requestPath = `${url.pathname.replace(/^\//, "")}${url.search}`;

  const client = new ApiClient({
    baseUrl: url.origin.replace(/\/$/, ""),
    headers: {
      "X-StellarTools-Signature": signature,
      "X-StellarTools-Event": eventType,
      "User-Agent": "StellarTools-Webhooks/1.0",
    },
    maxRetries: 0,
  });

  const result = await client.postDetailed(requestPath, body);

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

  await postDeliveryLog(
    { webhookId: webhook.id },
    {
      id: logId,
      eventType,
      request: payload,
      statusCode,
      errorMessage,
      responseTime: duration,
      response: responseData as Record<string, unknown> | null,
      description: `Delivery to ${webhook.url}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRetry: null,
      apiVersion: LATEST_VERSION,
      appInstallationId: null,
    },
    webhook.organizationId,
    webhook.environment
  );

  if (!isSuccess) {
    console.error(`✗ Webhook failed: ${webhook.url} (${statusCode})`);
    if (result.isErr()) console.log(result.error.message);
    throw new AppError("INTERNAL_ERROR", errorMessage ?? "Delivery failed");
  }

  console.log(`✓ Webhook delivered: ${webhook.url} in ${duration}ms`);

  return { success: true };
};
