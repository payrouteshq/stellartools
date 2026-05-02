import { z } from "zod";

import { APP_CONFIG, AppResource } from "./base";

export const appManifestSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200),
  iconUrl: z.url().optional(),
  homepageUrl: z.url(),

  baseUrl: z.url(),
  webhookUrl: z.url().optional(),

  scopes: z
    .array(
      z.string().refine(
        (val) => {
          const [action, resource] = val.split(":");
          return (
            val === "*" ||
            (["read", "write"].includes(action) &&
              APP_CONFIG[resource as AppResource].events.some((event) => event.includes(val)))
          );
        },
        { message: "Invalid scope format. Use 'read:resource' or 'write:resource'" }
      )
    )
    .min(1, "At least one scope is required"),

  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default("1.0.0"), // Semantic versioning
});

export type AppManifest = z.infer<typeof appManifestSchema>;
