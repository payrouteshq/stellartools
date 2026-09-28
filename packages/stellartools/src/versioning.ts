export const API_VERSIONS = [
  "2026-08-18",
  "2026-09-01", // CURRENT
] as const;

export type ApiVersion = (typeof API_VERSIONS)[number];

export const LATEST_VERSION: ApiVersion = API_VERSIONS.at(-1)!;

/**
 * Convention: [Action][Resource]Schema_[Version]
 * Example: CreateCustomerSchema_2026_08_18
 */
