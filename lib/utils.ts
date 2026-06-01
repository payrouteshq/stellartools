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
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
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

export const STROOPS_PER_XLM = 10_000_000;

export const formatCurrency = (amt: number, assetCode: string) => {
  const code = assetCode?.trim()?.toUpperCase();
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amt)} ${code}`;
};

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

export const xlmToStroops = (xlm: string): bigint => {
  const normalized = xlm.trim();
  const [whole, frac = ""] = normalized.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac)) throw new AppError(`Invalid XLM amount: ${xlm}`);
  if (frac.length > 7) throw new AppError(`Too many decimals for XLM: ${xlm}`); // stroop precision
  return BigInt(whole + frac.padEnd(7, "0"));
};

export const stroopsToXlm = (stroops: bigint): string => {
  const negative = stroops < BigInt(0);
  const abs = negative ? BigInt(-stroops) : stroops;

  const whole = abs / BigInt(10_000_000);
  const frac = abs % BigInt(10_000_000);

  // Always output 7 decimals for Stellar precision
  const fracStr = frac.toString().padStart(7, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${fracStr}`;
};
