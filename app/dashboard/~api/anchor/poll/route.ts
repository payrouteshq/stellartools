import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/error-handler";
import { Result, z as Schema } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const POST = apiHandler({
  auth: ["session", "apikey"],
  schema: {
    body: Schema.object({
      transferServer: Schema.string(),
      id: Schema.string(),
      anchorJwt: Schema.string(),
    }),
  },
  handler: async ({ body }) => {
    const resp = await fetch(`${body.transferServer}/transaction?id=${body.id}`, {
      headers: { Authorization: `Bearer ${body.anchorJwt}` },
    });

    if (!resp.ok) throw new AppError("Failed to fetch anchor transaction status");

    const data = await resp.json();

    if (!data.transaction) throw new AppError("Invalid response from anchor");

    return Result.ok(data.transaction);
  },
});
