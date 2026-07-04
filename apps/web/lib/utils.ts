import { AppError } from "@/lib/action-handler";
import { DocumentProps, pdf } from "@react-pdf/renderer";
import { Camelize, Snakize } from "@stellartools/core";
import crypto from "crypto";
import { saveAs } from "file-saver";
import _ from "lodash";
import moment from "moment";

type HashAlgorithm = "shake128" | "sha256";

export const truncate = (
  text: string,
  { start = 6, end = 4, separator = "..." }: { start?: number; end?: number; separator?: string } = {}
): string => {
  if (!text) return "";

  if (text.length <= start + end) {
    return text;
  }

  const prefix = start > 0 ? text.slice(0, start) : "";
  const suffix = end > 0 ? text.slice(-end) : "";

  return `${prefix}${separator}${suffix}`;
};

const safeStringify = (v: unknown) => JSON.stringify(v, (_, val) => (typeof val === "bigint" ? val.toString() : val));

export function computeDiff<T extends Record<string, any>>(
  oldData: T,
  newData: Partial<T>,
  ignoreKeys: string[] = ["updatedAt", "createdAt", "id"],
  delimiter?: string // e.g., "." to enable deep diff
): { data: Record<string, unknown>; previous_attributes: Record<string, unknown> } | null {
  const previousAttributes: Record<string, unknown> = {};
  const current: Record<string, unknown> = {};

  const isObject = (v: unknown) => v && typeof v === "object" && !Array.isArray(v);

  for (const key in newData) {
    if (ignoreKeys.includes(key)) continue;

    const oldVal = oldData?.[key];
    const newVal = newData[key];

    if (delimiter && isObject(oldVal) && isObject(newVal)) {
      const nestedDiff = computeDiff(
        oldVal as Partial<T[keyof T]>,
        newVal as Partial<T[keyof T]>,
        ignoreKeys,
        delimiter
      );

      if (nestedDiff) {
        Object.assign(previousAttributes, nestedDiff.previous_attributes);
        Object.assign(current, nestedDiff.data);
      }
    } else if (safeStringify(oldVal) !== safeStringify(newVal)) {
      previousAttributes[key] = oldVal ?? null;
      current[key] = newVal ?? null;
    }
  }

  if (Object.keys(previousAttributes).length === 0 && Object.keys(current).length === 0) {
    return null;
  }

  return {
    data: current,
    previous_attributes: previousAttributes,
  };
}

export const toSnakeCase = <T>(data: T): Snakize<T> => {
  // 1. Handle Arrays
  if (_.isArray(data)) {
    return data.map((item) => toSnakeCase(item)) as any;
  }

  // 2. Handle Objects (Only plain objects to avoid corrupting complex types)
  if (_.isPlainObject(data)) {
    const result: Record<string, any> = {};

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // _.snakeCase('checkoutId') -> 'checkout_id'
        const snakeKey = _.snakeCase(key);
        result[snakeKey] = toSnakeCase(data[key]);
      }
    }

    return result as any;
  }

  // 3. Handle Primitives (Strings, Numbers, BigInts, Booleans)
  return data as any;
};

export const toCamelCase = <T>(data: T): Camelize<T> => {
  if (_.isArray(data)) {
    return data.map((item) => toCamelCase(item)) as any;
  }

  if (_.isPlainObject(data)) {
    const result: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const camelKey = _.camelCase(key);
        // Runtime check: if we already set this key (manual override),
        // we might want to skip or overwrite. Usually, last-in wins in JS.
        result[camelKey] = toCamelCase(data[key]);
      }
    }
    return result as any;
  }

  return data as any;
};

export function generateResourceId(
  prefix: string,
  baseSignature: string,
  length: number,
  hashAlgorithm: HashAlgorithm = "shake128"
): string {
  if (!baseSignature || !prefix || length <= 0) {
    throw new AppError("Invalid arguments: baseSignature, prefix, and length (> 0) are required");
  }

  const hash =
    hashAlgorithm === "sha256"
      ? crypto.createHash("sha256").update(baseSignature).digest().subarray(0, 3)
      : crypto.createHash(hashAlgorithm, { outputLength: 3 }).update(baseSignature).digest();

  let signature = "";
  let value = (hash[0] << 16) | (hash[1] << 8) | hash[2];
  for (let i = 0; i < 4; i++) {
    signature += process.env.NEXT_PUBLIC_RESOURCE_ID_ALPHABET![value % 62];
    value = Math.floor(value / 62);
  }

  const bytes = crypto.randomBytes(length);
  let entropy = "";
  for (let i = 0; i < length; i++) {
    entropy += process.env.NEXT_PUBLIC_RESOURCE_ID_ALPHABET![bytes[i] % 62];
  }

  return `${prefix}_${signature}${entropy}`;
}

export type NormalizedChartPoint = {
  i: string; // The X-Axis key (Date/Time string)
  value: number; // The Y-Axis value
};

type RawDataPoint = Record<string, any>;

export function normalizeTimeSeries<T extends RawDataPoint>(
  data: T[] = [],
  count: number = 28,
  unit: moment.unitOfTime.DurationConstructor = "day"
): NormalizedChartPoint[] {
  const result: NormalizedChartPoint[] = [];
  const now = moment();

  // The formats match our SQL: date_trunc('day') -> YYYY-MM-DD, to_char(..., 'HH24') -> YYYY-MM-DDTHH
  const formatStr = unit === "day" ? "YYYY-MM-DD" : "YYYY-MM-DDTHH";

  for (let i = count - 1; i >= 0; i--) {
    const time = moment(now).subtract(i, unit);
    const key = time.format(formatStr);

    const match = data.find((p) => p.date === key || p.h === key || p.i === key);

    const rawVal = match ? (match.value ?? match.amount ?? match.count ?? match.c ?? 0) : 0;

    result.push({
      i: key,
      value: typeof rawVal === "string" ? parseFloat(rawVal) : rawVal,
    });
  }

  return result;
}

export const patchJSON = <T extends Record<string, any>>(
  base: T | null | undefined,
  patch: Partial<T> | null | undefined
): T => {
  const result = { ...(base || {}) } as T;
  if (!patch) return result;

  Object.entries(patch).forEach(([key, value]) => {
    if (value === null) {
      delete result[key as keyof T];
    } else {
      result[key as keyof T] = value as any;
    }
  });

  return result;
};

export const downloadReceipt = async (Component: React.ReactElement, filename: string) => {
  try {
    const blob = await pdf(Component as unknown as React.ReactElement<DocumentProps>).toBlob();
    saveAs(blob, `${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
  } catch (error) {
    console.error("PDF Export Failed:", error);
    throw new AppError("Could not generate receipt");
  }
};

export const maskData = (
  data: Record<string, any>,
  sensitiveKeys: string[],
  sensitivePrefix: string,
  encryptFn: (value: string) => string
): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (sensitiveKeys.includes(key) && typeof val === "string" && !val.startsWith(sensitivePrefix)) {
      out[key] = `${sensitivePrefix}${encryptFn(val)}`;
    } else if (val !== null && typeof val === "object") {
      out[key] = maskData(val, sensitiveKeys, sensitivePrefix, encryptFn);
    } else {
      out[key] = val;
    }
  }
  return out;
};

export const unmaskData = (
  data: Record<string, any>,
  sensitivePrefix: string,
  decryptFn: (value: string) => string
): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (typeof val === "string" && val.startsWith(sensitivePrefix)) {
      out[key] = decryptFn(val.slice(sensitivePrefix.length));
    } else if (val !== null && typeof val === "object") {
      out[key] = unmaskData(val, sensitivePrefix, decryptFn);
    } else {
      out[key] = val;
    }
  }
  return out;
};
