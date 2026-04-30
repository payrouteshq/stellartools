import _ from "lodash";

const RESOURCE_OBJECT_MAP: Record<string, string> = {
  cus: "customer",
  pay: "payment",
  sub: "subscription",
  ast: "asset",
  wh: "webhook",
  wh_evt: "event",
  rf: "refund",
  cwl: "payment_method",
};

const SENSITIVE_KEY_REGEXES: RegExp[] = [
  /organization[_-]?id/i,
  /account[_-]?id/i,
  /secret/i,
  /app[_-]?secret/i,
  /token/i,
  /encrypted/i,
  /password/i,
];

export const processResource = <T>(data: T, convertToSnakeCase: boolean = false): T => {
  if (_.isArray(data)) {
    return data.map((item) => processResource(item, convertToSnakeCase)).filter((i) => i !== undefined) as T;
  }
  if (!_.isPlainObject(data)) return data;

  const result: Record<string, T> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEXES.some((regex) => regex.test(key))) continue;

    if (value === null || value === undefined) continue;
    if (_.isArray(value) && value.length === 0) continue;

    const snakeKey = convertToSnakeCase ? _.snakeCase(key) : key;
    const processedValue = processResource(value, convertToSnakeCase);

    if (processedValue !== undefined) {
      result[snakeKey] = processedValue as T;
    }
  }

  // 3. Inject "object" name
  if (result.id && typeof result.id === "string") {
    const prefix = result.id.split("_")[0];
    result.object = (RESOURCE_OBJECT_MAP[prefix] ?? "unknown") as unknown as T;
  }

  // 4. Flatten Date objects to ISO strings
  if (data instanceof Date) return data.toISOString() as unknown as T;

  return result as unknown as T;
};
