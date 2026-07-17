"use server";

import { retrieveAccount as retrieveMerchantAccount } from "@/actions/account";
import { withEvent } from "@/actions/event";
import { resolveOrgContext, retrieveOrganization, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { Network, Payout, db, payouts } from "@/db";
import { MerchantPayoutProcessedEmail } from "@/emails/merchant-payout-processed";
import { sendEmail } from "@/integrations/email";
import { retrieveAccount } from "@/integrations/stellar-core";
import { generateResourceId } from "@/lib/utils";
import { EventTrigger } from "@/types";
import { and, desc, eq } from "drizzle-orm";

export interface WalletAsset {
  code: string;
  issuer: string | null;
  balance: number;
}

export const retrieveWalletBalance = async (): Promise<{
  assets: WalletAsset[];
  publicKey: string | null;
}> => {
  const { organizationId, environment } = await resolveOrgContext();

  const { secret } = await retrieveOrganizationIdAndSecret(organizationId, environment);

  if (!secret?.publicKey) return { assets: [], publicKey: null };

  const accountResult = await retrieveAccount(secret.publicKey, environment);
  if (accountResult.isErr()) return { assets: [], publicKey: secret.publicKey };
  const assets = accountResult.value.balances
    .map((b) => {
      const isNative = b.asset_type === "native";
      return {
        code: isNative ? "XLM" : ((b as any).asset_code as string),
        issuer: isNative ? null : ((b as any).asset_issuer as string),
        balance: parseFloat(b.balance),
      };
    })
    .filter((a) => a.balance > 0);
  return { assets, publicKey: secret.publicKey };
};

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

      return payout;
    },
    async (payout) => {
      let events: EventTrigger<typeof payout>[] = [];
      const sideEffects: Array<() => Promise<void>> = [];
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

        sideEffects.push(async () => {
          const [org, account] = await Promise.all([
            retrieveOrganization(payout.organizationId),
            retrieveMerchantAccount({ organizationId: payout.organizationId }),
          ]);
          if (!account?.email) return;
          await sendEmail(
            account.email,
            "Whops! Your payment has arrived 🎉",
            MerchantPayoutProcessedEmail({
              organizationName: org.name,
              organizationLogo: org.logoUrl,
              cryptoAmount: String(payout.cryptoAmount ?? ""),
              assetCode: payout.selectedAssetCode ?? "XLM",
              walletAddress: payout.walletAddress ?? "",
              transactionHash: payout.transactionHash ?? "",
            })
          );
        });
      }

      return {
        events,
        webhooks: {
          organizationId: payout.organizationId,
          environment: payout.environment,
          triggers: [],
        },
        sideEffects,
      };
    }
  );
};
