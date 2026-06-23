import { z } from "zod";

const settingValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type AppInstallationSettingValue = z.infer<typeof settingValueSchema>;

export const appInstallationSettingsSchema: z.ZodType<any> = z
  .lazy(() =>
    z.record(
      z.string().max(64), // Limit key length to 64 chars
      z.union([settingValueSchema, appInstallationSettingsSchema])
    )
  )
  .refine(
    (data) => {
      const size = JSON.stringify(data).length;
      return size <= 32768; // 32KB limit
    },
    {
      message: "Settings object is too large (max 32KB)",
    }
  );

export interface AppInstallationSettings {
  [key: string]: AppInstallationSettingValue;
}
