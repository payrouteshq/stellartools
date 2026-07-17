import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import type { ModuleProviderExports } from "@medusajs/types";

import { StellarToolsMedusaAdapter } from "./provider";
import { type StellarToolsMedusaAdapterOptions } from "./schema";

const provider: ModuleProviderExports = ModuleProvider(Modules.PAYMENT, {
  services: [StellarToolsMedusaAdapter],
});

export default provider;

export { type StellarToolsMedusaAdapterOptions, StellarToolsMedusaAdapter };
