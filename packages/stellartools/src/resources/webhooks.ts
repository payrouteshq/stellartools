import { Result } from "better-result";
import crypto from "crypto";
import { z } from "zod";

import { ApiClient } from "../api-client";
import { SignatureVerificationError } from "../errors";
import { CreateWebhook, UpdateWebhook, Webhook, WebhookEvent, createWebhookSchema, updateWebhookSchema } from "../schema/webhooks";
import { RequestOptions } from "../types";
import { mapOptionsToHeaders, unwrap, validateSchema } from "../utils";

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
  constructor(private apiClient: ApiClient) {
    super();
  }

  async create(params: CreateWebhook, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(createWebhookSchema, params), async (data) => {
        return await this.apiClient.post<Webhook>("/webhooks", data, mapOptionsToHeaders(options));
      })
    );
  }

  async retrieve(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.get<Webhook>(`/webhooks/${id}`, undefined, mapOptionsToHeaders(options));
      })
    );
  }

  async update(id: string, params: UpdateWebhook, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(updateWebhookSchema, params), async (data) => {
        return await this.apiClient.put<Webhook>(`/webhooks/${id}`, data, mapOptionsToHeaders(options));
      })
    );
  }

  async delete(id: string, options?: RequestOptions) {
    return unwrap(
      await Result.andThenAsync(validateSchema(z.string(), id), async (id) => {
        return await this.apiClient.delete<Webhook>(`/webhooks/${id}`, mapOptionsToHeaders(options));
      })
    );
  }
}
