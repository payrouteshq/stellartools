import { deleteWebhook, putWebhook, retrieveWebhooks } from "@/actions/webhook";
import { AppError } from "@/lib/action-handler";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { toCamelCase } from "@/lib/utils";
import { Result, z as Schema, UpdateWebhookSchema_2026_08_18 } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ webhookId: Schema.string() });

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:webhooks",
  schema: { params: paramsSchema },
  handler: async ({ params: { webhookId }, auth: { organizationId, environment } }) => {
    const {
      data: [webhook],
    } = await retrieveWebhooks(organizationId, environment, { id: webhookId });
    if (!webhook) return Result.err(new AppError("NOT_FOUND", "Webhook not found"));
    return Result.ok({
      id: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      name: webhook.name,
      description: webhook.description ?? undefined,
      isDisabled: webhook.isDisabled,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    });
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey"],
  schema: { params: paramsSchema, body: UpdateWebhookSchema_2026_08_18 },
  handler: async ({ params: { webhookId }, body, auth: { organizationId, environment } }) => {
    const response = await putWebhook(webhookId, toCamelCase(body), organizationId, environment);
    return Result.ok({
      id: response.id,
      url: response.url,
      secret: response.secret,
      events: response.events,
      name: response.name,
      description: response.description ?? undefined,
      isDisabled: response.isDisabled,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    });
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey"],
  schema: { params: paramsSchema },
  handler: async ({ params: { webhookId }, auth: { organizationId, environment } }) => {
    const response = await deleteWebhook(webhookId, organizationId, environment);
    return Result.ok(response);
  },
});
