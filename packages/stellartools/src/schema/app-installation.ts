import { z } from "zod";

/**
 * 1. Define the base primitives
 */
const settingValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type Primitive = z.infer<typeof settingValueSchema>;

export type AppInstallationSettings = {
  [key: string]: Primitive;
};

export const appInstallationSettingsSchema: z.ZodType<AppInstallationSettings> = z
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
