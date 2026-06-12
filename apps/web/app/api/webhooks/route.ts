import { postWebhook } from "@/actions/webhook";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { generateResourceId } from "@/lib/utils";
import { Result, z as Schema, createWebhookSchema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey", "app"],
  requiredAppScope: "write:webhooks",
  schema: { body: createWebhookSchema.extend({ secret: Schema.string().optional() }) },
  handler: async ({ body, auth: { organizationId, environment }, sessionToken }) => {
    const webhookPayload = {
      name: body.name,
      url: body.url,
      events: body.events,
      isDisabled: false,
      description: body.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      secret: sessionToken && body.secret ? body.secret : generateResourceId("whsec", organizationId, 32, "sha256"),
    };

    const response = await postWebhook(organizationId, environment, webhookPayload);

    return Result.ok(response);
  },
});
