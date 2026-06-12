import { Camelize, Snakize } from "@/types";
import { type ClassValue, clsx } from "clsx";
import crypto from "crypto";
import _ from "lodash";
import moment from "moment";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

import { AppError } from "./action-handler";

export const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
type HashAlgorithm = "shake128" | "sha256";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export const parseJSON = <T>(str: string, schema: z.ZodSchema<T>): T => {
  const parsed = JSON.parse(str);
  return schema.parse(parsed);
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

export const fileFromUrl = async (url: string, fileName: string): Promise<File> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type });
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

  const hash = crypto.createHash(hashAlgorithm, { outputLength: 3 }).update(baseSignature).digest();

  let signature = "";
  let value = (hash[0] << 16) | (hash[1] << 8) | hash[2];
  for (let i = 0; i < 4; i++) {
    signature += ALPHABET[value % 62];
    value = Math.floor(value / 62);
  }

  const bytes = crypto.randomBytes(length);
  let entropy = "";
  for (let i = 0; i < length; i++) {
    entropy += ALPHABET[bytes[i] % 62];
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

export const mergeWithNullDeletes = (
  base: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined
): Record<string, unknown> => {
  const result = { ...(base ?? {}) };
  if (!patch || typeof patch !== "object") return result;
  for (const key of Object.keys(patch)) {
    const v = patch[key];
    if (v === null || v === undefined) {
      delete result[key];
    } else {
      result[key] = v;
    }
  }
  return result;
};
