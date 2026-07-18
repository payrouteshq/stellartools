"use server";

import { withEvent } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import { Network, Refund, refunds } from "@/db";
import { db } from "@/db";
import { AppError } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { toSnakeCase } from "@/lib/utils";
import { EventTrigger, WebhookTrigger } from "@/types";
import { and, desc, eq } from "drizzle-orm";

export const postRefund = async (
  params: Omit<Refund, "organizationId" | "environment" | "createdAt" | "updatedAt">,
  orgId?: string,
  env?: Network,
  options?: { errorMessage?: string }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return withEvent(
    async () => {
      return await db
        .insert(refunds)
        .values({
          organizationId,
          environment,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...params,
        })
        .returning()
        .then(([refund]) => refund);
    },
    (refund) => {
      let events: EventTrigger<typeof refund>[] = [];
      let webhooksTriggers: WebhookTrigger<typeof refund>[] = [];

      if (refund.status == "failed") {
        events.push({
          type: "refund::failed",
          map: ({ id: refundId, customerId, paymentId, cryptoAmount, selectedAssetCode }) => ({
            customerId,
            data: { paymentId, refundId, amount: `${cryptoAmount} ${selectedAssetCode}` },
          }),
        });

        webhooksTriggers.push({
          event: "refund.failed",
          map: ({
            id: refundId,
            paymentId,
            cryptoAmount,
            customerId,
            selectedAssetCode,
            createdAt,
            receiverWalletAddress,
            reason,
            status,
            metadata,
          }) => ({
            object: toSnakeCase({
              id: refundId,
              paymentId,
              customerId,
              amount: `${cryptoAmount} ${selectedAssetCode}`,
              reason: reason!,
              status,
              createdAt: createdAt.toISOString(),
              metadata,
              receiverWalletAddress,
              // @ts-ignore - error is not a valid property for the webhook object but might be needed by the merchant for debugging
              error: options?.errorMessage,
            }),
            previous_attributes: undefined,
          }),
        });
      }

      if (refund.status == "succeeded") {
        events.push({
          type: "refund::created",
          map: ({
            id: refundId,
            paymentId,
            amountCents,
            currencyCode,
            customerId,
            selectedAssetCode,
            cryptoAmount,
            reason,
          }) => ({
            customerId,
            data: {
              paymentId,
              refundId,
              amount: Money.formatFiat(amountCents, currencyCode),
              cryptoAmount: `${cryptoAmount} ${selectedAssetCode}`,
              reason,
            },
          }),
        });

        webhooksTriggers.push({
          event: "refund.succeeded",
          map: ({
            id: refundId,
            paymentId,
            amountCents,
            currencyCode,
            customerId,
            selectedAssetCode,
            cryptoAmount,
            reason,
            createdAt,
            receiverWalletAddress,
            metadata,
            status,
          }) => ({
            object: toSnakeCase({
              id: refundId,
              amount: Money.formatFiat(amountCents, currencyCode),
              cryptoAmount: `${cryptoAmount} ${selectedAssetCode}`,
              paymentId,
              customerId,
              reason: reason!,
              createdAt: createdAt.toISOString(),
              metadata,
              receiverWalletAddress,
              status,
            }),
            previous_attributes: undefined,
          }),
        });
      }
      return {
        events,
        webhooks: { organizationId, environment, triggers: webhooksTriggers },
      };
    }
  );
};

export const getRefund = async (id: string, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [refund] = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.id, id), eq(refunds.organizationId, organizationId), eq(refunds.environment, environment)))
    .limit(1);

  if (!refund) throw new AppError("NOT_FOUND", "Refund not found");

  return refund;
};

export const updateRefund = async (id: string, retUpdate: Partial<Refund>, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [refund] = await db
    .update(refunds)
    .set({ ...retUpdate, updatedAt: new Date() } as Refund)
    .where(and(eq(refunds.id, id), eq(refunds.organizationId, organizationId), eq(refunds.environment, environment)))
    .returning();

  if (!refund) throw new AppError("INTERNAL_ERROR", "Failed to update refund");

  return refund as Refund;
};

export const deleteRefund = async (id: string, organizationId: string) => {
  await db
    .delete(refunds)
    .where(and(eq(refunds.id, id), eq(refunds.organizationId, organizationId)))
    .returning();

  return null;
};

export const getRefunds = async (organizationId: string) => {
  const refundsList = await db
    .select()
    .from(refunds)
    .where(eq(refunds.organizationId, organizationId))
    .orderBy(desc(refunds.createdAt));

  if (!refundsList) throw new AppError("INTERNAL_ERROR", "Failed to get refunds");

  return refundsList;
};
