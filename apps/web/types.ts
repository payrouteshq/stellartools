import { Network } from "@/constant/schema.client";
import { computeDiff } from "@/lib/utils";
import { AppScope, EventType } from "@stellartools/app-sdk/schema";
import { MaybeArray, WebhookEventType, WebhookObject } from "@stellartools/core";

export type EventDataDiff = { $changes?: ReturnType<typeof computeDiff> };

export interface EventEmitParams {
  type: EventType;
  customerId?: string | null; // for customer operations
  merchantId?: string | null; // for merchant operations
  subscriptionId?: string | null;
  data?: Record<
    string,
    string | number | boolean | null | undefined | Date | EventDataDiff | ReturnType<typeof computeDiff>
  >;
}

export interface EventTrigger<T> {
  type: EventType;
  map: (result: T) => MaybeArray<Omit<EventEmitParams, "type">>;
}

export interface WebhookTrigger<T, K extends WebhookEventType = WebhookEventType> {
  event: K;
  map: (result: T) => {
    object: WebhookObject<K>;
    previous_attributes?: Partial<WebhookObject<K>>;
  };
}

export interface EventConfig<T> {
  events?: MaybeArray<EventTrigger<T>>;
  webhooks?: {
    organizationId: string;
    environment: Network;
    triggers: MaybeArray<WebhookTrigger<T, any>>;
  };
  sideEffects?: Array<() => Promise<void>>;
}

export type AuthContext = {
  organizationId: string;
  environment: Network;
  type: "session" | "apikey" | "portal" | "app";
  appId?: string; // Only present if type === "app"
  installationId?: string; // Only present if type === "app"
  scopes?: AppScope[];
  apiKeyId?: string; // Only present if type === "apikey"
};

export type ApiListParams = {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
};

export type PaginatedResult<T> = {
  data: T[];
  has_more: boolean;
};

export interface ApiObject {
  id: string;
  object: string;
}

export type ApiList<T> = {
  object: "list";
  data: T[];
  has_more: boolean;
  url: string;
};

export type ApiResponse<T> = T & {
  object: string;
  live_mode: boolean;
  billing_details?: any;
  latest_attempt?: any;
  next_action?: any;
  line_items?: ApiList<any>;
  related_resources?: Record<string, any>;
};

// -- INTERNAL

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : S;

/**
 * ALPHA LOGIC: If an object has both 'units_per_credit' and 'unitsPerCredit',
 * this utility omits 'units_per_credit' so the override wins.
 */
type CleanKeys<T> = {
  [K in keyof T as K extends string
    ? CamelCase<K> extends keyof T
      ? K extends CamelCase<K>
        ? K
        : never
      : K
    : K]: T[K];
};

export type Camelize<T> = T extends Date
  ? T
  : T extends Array<infer U>
    ? Array<Camelize<U>>
    : T extends object
      ? { [K in keyof CleanKeys<T> as CamelCase<string & K>]: Camelize<CleanKeys<T>[K]> }
      : T;

type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Uppercase<T>
    ? T extends Lowercase<T>
      ? `${T}${SnakeCase<U>}`
      : `_${Lowercase<T>}${SnakeCase<U>}`
    : `${T}${SnakeCase<U>}`
  : S;

// Removes the leading underscore if the original key was already PascalCase
type SnakizeKey<S extends string> = SnakeCase<S> extends `_${infer T}` ? T : SnakeCase<S>;

export type Snakize<T> = T extends Date
  ? T
  : T extends Array<infer U>
    ? Array<Snakize<U>>
    : T extends object
      ? { [K in keyof T as SnakizeKey<string & K>]: Snakize<T[K]> }
      : T;
