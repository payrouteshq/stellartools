import { z } from "zod";

import { ApiVersion } from "../versioning";

/**
 * 1. Define the base primitives
 */
const settingValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type Primitive = z.infer<typeof settingValueSchema>;

export type AppInstallationSettings = {
  [key: string]: Primitive;
};

export const AppInstallationSettingsSchema_2026_08_18: z.ZodType<AppInstallationSettings> = z
  .lazy(() => z.record(z.string().max(64), settingValueSchema))
  .refine(
    (data) => {
      const size = JSON.stringify(data).length;
      return size <= 32768; // 32KB limit
    },
    {
      message: "Settings object is too large (max 32KB)",
    }
  );

export const APP_INSTALLATION_STATUS = ["active", "suspended"] as const;

export type AppInstallationStatus = (typeof APP_INSTALLATION_STATUS)[number];

export const APP_INSTALLATION_SCHEMAS = {
  "2026-08-18": { settings: AppInstallationSettingsSchema_2026_08_18 },
} satisfies Partial<Record<ApiVersion, { settings: z.ZodSchema }>>;
