import crypto from "crypto";

import { ApiClient } from "../api-client";
import { SignatureVerificationError } from "../errors";
import { CreateWebhook, UpdateWebhook, WEBHOOK_SCHEMAS, Webhook, WebhookEvent } from "../schema/webhooks";
import { RequestOptions } from "../types";
import { unwrap } from "../utils";
import { ApiVersion } from "../versioning";
import { BaseApiResource } from "./base";

export class WebhookSigner {
  constructor() {}

  generateSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const hmac = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    return `t=${timestamp},v1=${hmac}`;
  }

  /**
   * Constructs and verifies the signature of an Event from the provided details.
   *
   * @throws StellarTools.errors.SignatureVerificationError
   */
  constructEvent(payload: string, signature: string, secret: string, tolerance: number = 300): WebhookEvent {
    try {
      const parts = signature.split(",");
      const timestamp = parseInt(parts[0].split("=")[1]);
      const receivedSignature = parts[1].split("=")[1];
      const now = Math.floor(Date.now() / 1000);

      if (Math.abs(now - timestamp) > tolerance) throw new SignatureVerificationError("Invalid Webhook Signature");

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
      const isVerified = crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));

      if (!isVerified) throw new SignatureVerificationError("Invalid Webhook Signature");

      return JSON.parse(payload) as WebhookEvent;
    } catch {
      throw new SignatureVerificationError("Unknown error occurred while constructing the event");
    }
  }
}

export class WebhookApi extends WebhookSigner {
  private resource: WebhookResourceApi;

  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super();
    this.resource = new WebhookResourceApi(apiClient, version);
  }

  async create(params: CreateWebhook, options?: RequestOptions) {
    return this.resource.create(params, options);
  }

  async retrieve(id: string, options?: RequestOptions) {
    return this.resource.retrieve(id, options);
  }

  async update(id: string, params: UpdateWebhook, options?: RequestOptions) {
    return this.resource.update(id, params, options);
  }

  async delete(id: string, options?: RequestOptions) {
    return this.resource.delete(id, options);
  }
}

class WebhookResourceApi extends BaseApiResource {
  constructor(apiClient: ApiClient, version?: ApiVersion) {
    super(apiClient, version);
  }

  async create(params: CreateWebhook, options?: RequestOptions) {
    const data = this.validate<CreateWebhook>(WEBHOOK_SCHEMAS, "create", params);
    return unwrap(await this.apiClient.post<Webhook>("/webhooks", data, this.getHeaders(options)));
  }

  async retrieve(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(WEBHOOK_SCHEMAS, "retrieve", { id });
    return unwrap(await this.apiClient.get<Webhook>(`/webhooks/${validId}`, undefined, this.getHeaders(options)));
  }

  async update(id: string, params: UpdateWebhook, options?: RequestOptions) {
    const data = this.validate<UpdateWebhook>(WEBHOOK_SCHEMAS, "update", params);
    return unwrap(await this.apiClient.put<Webhook>(`/webhooks/${id}`, data, this.getHeaders(options)));
  }

  async delete(id: string, options?: RequestOptions) {
    const { id: validId } = this.validate<{ id: string }>(WEBHOOK_SCHEMAS, "retrieve", { id });
    return unwrap(await this.apiClient.delete<Webhook>(`/webhooks/${validId}`, this.getHeaders(options)));
  }
}
