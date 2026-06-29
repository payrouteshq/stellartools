import { deleteWebhook, putWebhook, retrieveWebhooks } from "@/actions/webhook";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { toCamelCase } from "@/lib/utils";
import { Result, z as Schema, updateWebhookSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ webhookId: Schema.string() });

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:webhooks",
  schema: { params: paramsSchema },
  handler: async ({ params: { webhookId }, auth: { organizationId, environment } }) => {
    const response = await retrieveWebhooks(organizationId, environment, { id: webhookId });
    return Result.ok(response);
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey"],
  schema: { params: paramsSchema, body: updateWebhookSchema },
  handler: async ({ params: { webhookId }, body, auth: { organizationId, environment } }) => {
    const response = await putWebhook(webhookId, toCamelCase(body), organizationId, environment);
    return Result.ok(response);
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
