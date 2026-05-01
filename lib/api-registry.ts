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

export const processResource = <T>(data: T, convertToSnakeCase: boolean = false): any => {
  if (typeof data === "bigint") return Number(data.toString());

  if (data instanceof Date) return data.toISOString();

  if (data === null || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => processResource(item, convertToSnakeCase)).filter((v) => v !== undefined);
  }

  if (_.isPlainObject(data)) {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEXES.some((regex) => regex.test(key))) continue;

      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;

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
