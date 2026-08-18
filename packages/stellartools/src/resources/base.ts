import { ApiClient } from "../api-client";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";
import { ApiVersion, LATEST_VERSION } from "../versioning";

export abstract class BaseApiResource {
  constructor(
    protected apiClient: ApiClient,
    protected version: ApiVersion = LATEST_VERSION
  ) {}

  protected validate<T>(registry: Record<ApiVersion, any>, method: string, data: unknown): T {
    const schemas = registry[this.version] ?? registry[LATEST_VERSION];
    const schema = schemas?.[method];
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
