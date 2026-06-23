import "server-only";

import { generateAppToken } from "@/actions/app";
import { postWebhookLog } from "@/actions/webhook";
import { App } from "@/db/schema";
import { decrypt } from "@/integrations/encryption";
import { AppError } from "@/lib/action-handler";
import { Network, WebhookEventBase, WebhookSigner } from "@stellartools/core";

export const deliverToApp = async (
  app: App,
  appInstallationId: string,
  event: WebhookEventBase<any, any>,
  webhookLogId: string,
  settings: Record<string, any> | null,
  organizationId: string,
  environment: Network
) => {
  const webhookUrl = app.webhookUrl;

  if (!webhookUrl) throw new AppError("App webhook URL not found");

  const startTime = Date.now();

  const body = JSON.stringify({ event, settings: settings ?? {} });

  const signer = new WebhookSigner();
  const signature = signer.generateSignature(body, decrypt(app.appSecret));

  const appToken = await generateAppToken(
    appInstallationId,
    { periodDays: 30, currency: "USD", theme: "light" },
    organizationId,
    environment
  );

  if (!appToken) throw new AppError("Failed to generate app token");

  try {
    const response = await fetch(app.webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StellarTools-Signature": signature,
        "X-StellarTools-App-Id": app.id,
        "X-StellarTools-App-Token": appToken,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;

    await postWebhookLog(
      app.id,
      {
        id: webhookLogId,
        eventType: event.type,
        request: event,
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
      organizationId,
      environment
    );

    return { success: response.ok };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    await postWebhookLog(
      app.id,
      {
        id: webhookLogId,
        eventType: event.type,
        request: event,
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
      organizationId,
      environment
    );

    return { success: false, error: error.message };
  }
};
