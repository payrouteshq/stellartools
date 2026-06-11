"use server";

import { withEvent } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import { Network, Payout, charges, db, payouts } from "@/db";
import { generateResourceId } from "@/lib/utils";
import { EventTrigger } from "@/types";
import { and, desc, eq, isNull } from "drizzle-orm";

export const retrievePayouts = async () => {
  const { organizationId, environment } = await resolveOrgContext();
  return db
    .select()
    .from(payouts)
    .where(and(eq(payouts.organizationId, organizationId), eq(payouts.environment, environment)))
    .orderBy(desc(payouts.createdAt));
};

export const retrievePayoutById = async (id: string) => {
  const { organizationId } = await resolveOrgContext();

  const [payout] = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.id, id), eq(payouts.organizationId, organizationId)))
    .limit(1);

  return payout ?? null;
};

export const postPayout = async (
  params: Omit<Payout, "organizationId" | "environment" | "createdAt" | "updatedAt">,
  orgId?: string,
  env?: Network
) => {
  let eventId: string | null = null;

  return withEvent(
    async () => {
      const { organizationId, environment } = await resolveOrgContext(orgId, env);
      eventId = generateResourceId("evt", organizationId, 25);
      const [result] = await db
        .insert(payouts)
        .values({ ...params, organizationId, environment })
        .returning();

      return result;
    },
    {
      events: [
        {
          type: "payout::requested",
          map: (payout: any) => ({
            id: eventId as string,
            merchantId: payout.organizationId,
            data: { amount: payout.amount, walletAddress: payout.walletAddress, memo: payout.memo },
          }),
        },
      ],
    }
  );
};

export const putPayout = async (id: string, params: Partial<Payout>) => {
  return withEvent(
    async () => {
      const [payout] = await db.update(payouts).set(params).where(eq(payouts.id, id)).returning();

      if (params.status === "succeeded" && payout) {
        await db
          .update(charges)
          .set({ clearedAt: new Date() })
          .where(
            and(
              eq(charges.organizationId, payout.organizationId),
              eq(charges.environment, payout.environment),
              isNull(charges.clearedAt)
            )
          );
      }

      return payout;
    },
    (payout) => {
      let events: EventTrigger<typeof payout>[] = [];
      const eventId = generateResourceId("evt", id, 25);

      if (payout.status == "succeeded") {
        events.push({
          type: "payout::processed",
          map: (payout) => ({
            id: eventId,
            merchantId: payout.organizationId,
            data: {
              amount: `${Number(payout.amountCents) / 100} ${payout.currencyCode}`,
              walletAddress: payout.walletAddress,
              memo: payout.memo,
              transactionHash: payout.transactionHash,
            },
          }),
        });
      }

      return { events };
    }
  );
};
