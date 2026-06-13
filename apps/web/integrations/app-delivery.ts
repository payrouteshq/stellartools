import "server-only";

import { postWebhookLog } from "@/actions/webhook";
import { App } from "@/db/schema";
import { decrypt } from "@/integrations/encryption";
import { WebhookSigner } from "@stellartools/core";

export const deliverToApp = async (app: App, appInstallationId: string, envelope: any, webhookLogId: string) => {
  const startTime = Date.now();

  const decryptedSecret = decrypt(app.appSecret);

  const body = JSON.stringify(envelope);

  const signature = new WebhookSigner().generateSignature(body, decryptedSecret);

  try {
    const response = await fetch(app.webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StellarTools-Signature": signature,
        "X-StellarTools-App-Id": app.id,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;

    await postWebhookLog(
      app.id,
      {
        id: webhookLogId,
        eventType: envelope.type,
        request: envelope,
        statusCode: response.status,
        responseTime: duration,
        description: `Plugin delivery to ${app.name}`,
        apiVersion: app.manifest?.version ?? "unknown",
        response: await response.json().catch(() => ({})),
        createdAt: new Date(),
        updatedAt: new Date(),
        errorMessage: null,
        nextRetry: null,
        appInstallationId,
      },
      envelope.organizationId,
      envelope.environment
    );

    return { success: response.ok };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    await postWebhookLog(
      app.id,
      {
        id: webhookLogId,
        eventType: envelope.type,
        request: envelope,
        statusCode: 500,
        errorMessage: error.message,
        responseTime: duration,
        description: `Failed plugin delivery to ${app.name}`,
        apiVersion: app.manifest?.version ?? "unknown",
        response: null,
        nextRetry: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appInstallationId,
      },
      envelope.organizationId,
      envelope.environment
    );

    return { success: false, error: error.message };
  }
};
