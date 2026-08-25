"use server";

import { retrieveAccount as retrieveMerchantAccount } from "@/actions/account";
import { withEvent } from "@/actions/event";
import { resolveOrgContext, retrieveOrganization, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { Network, Payout, db, payouts } from "@/db";
import { MerchantPayoutProcessedEmail } from "@/emails/merchant-payout-processed";
import { sendEmail } from "@/integrations/email";
import { retrieveAccount } from "@/integrations/stellar-core";
import { Money } from "@/lib/money";
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
    .flatMap((balance): WalletAsset[] => {
      if (balance.asset_type === "native") {
        return [{ code: "XLM", issuer: null, balance: parseFloat(balance.balance) }];
      }
      if ("asset_code" in balance && "asset_issuer" in balance) {
        return [
          {
            code: balance.asset_code,
            issuer: balance.asset_issuer,
            balance: parseFloat(balance.balance),
          },
        ];
      }
      return [];
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
  params: Omit<typeof payouts.$inferInsert, "organizationId" | "environment" | "createdAt">,
  orgId?: string,
  env?: Network
) => {
  return withEvent(
    async () => {
      const { organizationId, environment } = await resolveOrgContext(orgId, env);
      const [result] = await db
        .insert(payouts)
        .values({ ...params, organizationId, environment })
        .returning();

      return result;
    },
    (payout) => ({
      events: [
        {
          type: "payout::requested",
          map: () => ({
            merchantId: payout.organizationId,
            data: {
              payoutId: payout.id,
              amount: Money.formatFiat(payout.amountCents, payout.currencyCode),
              cryptoAmount: Money.formatCrypto(payout.cryptoAmount, payout.selectedAssetCode ?? "XLM"),
              walletAddress: payout.walletAddress,
              memo: payout.memo,
              status: "pending",
            },
          }),
        },
      ],
      webhooks: {
        organizationId: payout.organizationId,
        environment: payout.environment,
        triggers: [],
      },
    })
  );
};

export const putPayout = async (id: string, params: Partial<Payout>) => {
  let previousStatus: Payout["status"] | undefined;
  return withEvent(
    async () => {
      const [existing] = await db.select({ status: payouts.status }).from(payouts).where(eq(payouts.id, id)).limit(1);
      previousStatus = existing?.status;
      const [payout] = await db.update(payouts).set(params).where(eq(payouts.id, id)).returning();

      return payout;
    },
    async (payout) => {
      let events: EventTrigger<typeof payout>[] = [];
      const sideEffects: Array<() => Promise<void>> = [];

      if (payout.status === "succeeded" && previousStatus !== "succeeded") {
        events.push({
          type: "payout::processed",
          map: (payout) => ({
            merchantId: payout.organizationId,
            data: {
              payoutId: payout.id,
              amount: Money.formatFiat(payout.amountCents, payout.currencyCode),
              cryptoAmount: Money.formatCrypto(payout.cryptoAmount, payout.selectedAssetCode ?? "XLM"),
              walletAddress: payout.walletAddress,
              memo: payout.memo,
              transactionHash: `${payout.transactionHash}:${payout.environment}`,
              status: "succeeded",
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
              transactionHash: `${payout.transactionHash}:${payout.environment}`,
              payoutMethod: payout.method,
              fiatAmount:
                payout.method === "fiat" ? Money.formatFiat(payout.amountCents, payout.currencyCode) : undefined,
              destinationLabel:
                payout.method === "fiat"
                  ? `${payout.withdrawalMethod ?? "Provider payout"} · ${payout.destinationCurrency ?? payout.currencyCode}`
                  : undefined,
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
