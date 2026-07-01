import "server-only";

import { generateAppToken } from "@/actions/app";
import { postDeliveryLog } from "@/actions/webhook";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { App } from "@/db/schema";
import { decrypt } from "@/integrations/encryption";
import { AppError } from "@/lib/action-handler";
import { unmaskData } from "@/lib/utils";
import { AppInstallationSettings, Network, WebhookEventBase, WebhookSigner } from "@stellartools/core";

export const deliverToApp = async <TName extends string, TObject>(
  app: App,
  appInstallationId: string,
  envelope: WebhookEventBase<TName, TObject> & { organizationId: string; environment: Network },
  appInstallationDeliveryLogId: string,
  rawSettings: AppInstallationSettings | null
) => {
  const startTime = Date.now();

  const webhookUrl = app.webhookUrl;

  if (!webhookUrl) throw new AppError("App webhook URL not found");

  const { organizationId, environment, ...eventData } = envelope;

  const body = JSON.stringify({
    event: eventData,
    settings: unmaskData(rawSettings ?? {}, SENSITIVE_KEY_PREFIX, decrypt),
  });

  try {
    const signer = new WebhookSigner();
    const signature = signer.generateSignature(body, decrypt(app.appSecret.replace(SENSITIVE_KEY_PREFIX, "")));

    const appToken = await generateAppToken(
      appInstallationId,
      { periodDays: 30, currency: "USD", theme: "light" },
      organizationId,
      environment
    );

    if (!appToken) throw new AppError("Failed to generate app token");

    const response = await fetch(webhookUrl, {
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

    await postDeliveryLog(
      { appInstallationId },
      {
        id: appInstallationDeliveryLogId,
        eventType: envelope.type,
        request: JSON.parse(body),
        statusCode: response.status,
        responseTime: duration,
        description: `Plugin delivery to ${app.name}`,
        apiVersion: app.version ?? "unknown",
        response: await response.json().catch(() => ({ message: response.statusText || `HTTP ${response.status}` })),
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

    await postDeliveryLog(
      { appInstallationId },
      {
        id: appInstallationDeliveryLogId,
        eventType: envelope.type,
        request: JSON.parse(body),
        statusCode: 500,
        errorMessage: error.message,
        responseTime: duration,
        description: `Failed plugin delivery to ${app.name}`,
        apiVersion: app.version ?? "unknown",
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
