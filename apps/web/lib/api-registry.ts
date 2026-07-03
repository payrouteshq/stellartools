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
  cz: "checkout",
  prod: "product",
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

export const processResource = <T>(data: T, convertToSnakeCase: boolean = false): any => {
  if (typeof data === "bigint") return Number(data.toString());

  if (data instanceof Date) return data.toISOString();

  if (data === null || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => processResource(item, convertToSnakeCase)).filter((v) => v !== undefined);
  }

  if (_.isPlainObject(data)) {
    const result: Record<string, any> = {};

    for (const [rawKey, value] of Object.entries(data)) {
      // A leading `*` is an explicit opt-out: return the key even if it looks sensitive
      // (the `*` is stripped from the output). we should use this only when you know what you're doing.
      const forced = rawKey.startsWith("*");
      const key = forced ? rawKey.slice(1) : rawKey;

      if (!forced && SENSITIVE_KEY_REGEXES.some((regex) => regex.test(key))) continue;

      if (value === undefined) continue;

      const targetKey = convertToSnakeCase ? _.snakeCase(key) : key;

      const processedValue = processResource(value, convertToSnakeCase);

      if (processedValue !== undefined) {
        result[targetKey] = processedValue;
      }
    }

    if (typeof result.id === "string" && !result.object) {
      const prefix = result.id.split("_")[0];
      result.object = RESOURCE_OBJECT_MAP[prefix] ?? "unknown";
    }

    return result;
  }

  return data;
};
