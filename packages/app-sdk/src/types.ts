import { AppInstallationSettingValue, Network } from "@stellartools/core";

import { AppScope } from "./schema";

export interface AppContext {
  orgId: string;
  env: Network;
  instId: string;
  appId: string;

  // Scopes & Permissions
  scopes: Array<AppScope>;

  // Data State (Decrypted settings for the app to use immediately)
  settings: Record<string, AppInstallationSettingValue>;

  ui: {
    periodDays: number; // The "30 days" or "7 days" selected in the dashboard
    currency: string; // The dashboard's current display currency
    theme: "light" | "dark";
  };
}
