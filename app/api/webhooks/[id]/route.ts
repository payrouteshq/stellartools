import { deleteWebhook, putWebhook, retrieveWebhooks } from "@/actions/webhook";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { toCamelCase } from "@/lib/utils";
import { Result, z as Schema, updateWebhookSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

const paramsSchema = Schema.object({ id: Schema.string() });

export const GET = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "read:webhooks",
  schema: { params: paramsSchema },
  handler: async ({ params: { id }, auth: { organizationId, environment } }) => {
    const response = await retrieveWebhooks(organizationId, environment, { id });
    return Result.ok(response);
  },
});

export const PUT = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:webhooks",
  schema: { params: paramsSchema, body: updateWebhookSchema },
  handler: async ({ params: { id }, body, auth: { organizationId, environment } }) => {
    const response = await putWebhook(id, toCamelCase(body), organizationId, environment);
    return Result.ok(response);
  },
});

export const DELETE = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:webhooks",
  schema: { params: paramsSchema },
  handler: async ({ params: { id }, auth: { organizationId, environment } }) => {
    const response = await deleteWebhook(id, organizationId, environment);
    return Result.ok(response);
  },
});
