import { ApiClient } from "../api-client";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";
import { API_VERSIONS, ApiVersion, LATEST_VERSION } from "../versioning";

export abstract class BaseApiResource {
  constructor(
    protected apiClient: ApiClient,
    protected version: ApiVersion = LATEST_VERSION
  ) {}

  protected validate<T>(registry: Partial<Record<ApiVersion, any>>, method: string, data: unknown): T {
    const available = API_VERSIONS.filter((v) => registry[v]);
    const resolved = available.filter((v) => v <= this.version).at(-1) ?? available.at(-1);
    const schema = resolved ? registry[resolved]?.[method] : undefined;
    if (!schema) throw new Error(`No schema for "${method}" in version ${this.version}`);
    return unwrap(validateSchema(schema, data));
  }

  protected getHeaders(options?: RequestOptions): Record<string, string> {
    return {
      ...mapOptionsToHeaders(options),
      "StellarTools-Version": options?.version ?? this.version,
    };
  }
}
