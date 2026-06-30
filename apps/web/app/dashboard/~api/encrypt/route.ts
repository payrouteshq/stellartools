import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { encrypt } from "@/integrations/encryption";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["vercelToken"],
  schema: { body: Schema.object({ text: Schema.string().min(1) }) },
  handler: async ({ body }) => {
    // `*` opt-out: processResource would otherwise strip the "encrypted" key as sensitive.
    return Result.ok({ "*encrypted": `${SENSITIVE_KEY_PREFIX}${encrypt(body.text)}` });
  },
});
