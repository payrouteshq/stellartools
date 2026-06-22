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
      z
        .string()
        .refine((val) => val === "*" || (val.startsWith("read:") && (val.split(":")[1] as AppResource) in APP_CONFIG), {
          message: `Invalid scope. Use 'read:<resource>' where resource is one of: ${Object.keys(APP_CONFIG).join(", ")}`,
        })
    )
    .min(1, "At least one scope is required"),

  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default("1.0.0"), // Semantic versioning
});

export type AppManifest = z.infer<typeof appManifestSchema>;
