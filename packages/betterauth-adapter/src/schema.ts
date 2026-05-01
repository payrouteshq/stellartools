import { BetterAuthPluginDBSchema } from "better-auth";

export const pluginSchema = {
  user: {
    fields: {
      stellartools_customer_id: {
        type: "string",
        required: false,
        unique: true,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;
