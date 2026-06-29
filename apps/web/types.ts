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
  type: "session" | "apikey" | "portal" | "app" | "vercelToken";
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

// -- INTERNAL
