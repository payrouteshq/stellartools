"use server";

import { resolveOrgContext } from "@/actions/organization";
import {
  CreditBalance,
  CreditTransaction,
  Network,
  creditBalances,
  creditTransactions,
  customers,
  db,
  products,
} from "@/db";
import { safeAction } from "@/lib/action-handler";
import { generateResourceId } from "@/lib/utils";
import { and, desc, eq } from "drizzle-orm";

export const postCreditBalance = async (
  params: Omit<CreditBalance, "id" | "organizationId" | "environment" | "createdAt" | "updatedAt" | "isRevoked">,
  orgId: string,
  env: Network
) => {
  return await db
    .insert(creditBalances)
    .values({
      id: generateResourceId("cb", orgId, 20),
      organizationId: orgId,
      environment: env,
      createdAt: new Date(),
      updatedAt: new Date(),
      isRevoked: false,
      ...params,
    })
    .returning()
    .then(([creditBalance]) => creditBalance);
};

export const retrieveCreditBalance = async (customerId: string, productId: string, organizationId: string) => {
  return await db
    .select()
    .from(creditBalances)
    .where(
      and(
        eq(creditBalances.customerId, customerId),
        eq(creditBalances.productId, productId),
        eq(creditBalances.organizationId, organizationId)
      )
    )
    .limit(1)
    .then(([creditBalance]) => creditBalance);
};

export const retrieveCreditBalanceById = async (id: string) => {
  return await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.id, id))
    .limit(1)
    .then(([creditBalance]) => creditBalance);
};

export const putCreditBalance = safeAction(async (id: string, retUpdate: Partial<CreditBalance>) => {
  return await db
    .update(creditBalances)
    .set({ ...retUpdate, updatedAt: new Date() })
    .where(eq(creditBalances.id, id))
    .returning()
    .then(([record]) => record);
});

export const deleteCreditBalance = async (id: string) => {
  return await db
    .delete(creditBalances)
    .where(eq(creditBalances.id, id))
    .returning()
    .then(() => null);
};

export const retrieveCreditBalances = async () => {
  const { organizationId, environment } = await resolveOrgContext();
  return db
    .select({
      id: creditBalances.id,
      organizationId: creditBalances.organizationId,
      customerId: creditBalances.customerId,
      productId: creditBalances.productId,
      balance: creditBalances.balance,
      consumed: creditBalances.consumed,
      granted: creditBalances.granted,
      createdAt: creditBalances.createdAt,
      updatedAt: creditBalances.updatedAt,
      isRevoked: creditBalances.isRevoked,
      customerName: customers.name,
      customerEmail: customers.email,
      productName: products.name,
    })
    .from(creditBalances)
    .leftJoin(customers, eq(creditBalances.customerId, customers.id))
    .leftJoin(products, eq(creditBalances.productId, products.id))
    .where(and(eq(creditBalances.organizationId, organizationId), eq(creditBalances.environment, environment)))
    .orderBy(desc(creditBalances.createdAt));
};

export const retrieveCreditTransactionsByBalance = async (balanceId: string) => {
  const { organizationId } = await resolveOrgContext();
  return db
    .select({
      id: creditTransactions.id,
      organizationId: creditTransactions.organizationId,
      customerId: creditTransactions.customerId,
      productId: creditTransactions.productId,
      balanceId: creditTransactions.balanceId,
      amount: creditTransactions.amount,
      balanceBefore: creditTransactions.balanceBefore,
      balanceAfter: creditTransactions.balanceAfter,
      reason: creditTransactions.reason,
      type: creditTransactions.type,
      metadata: creditTransactions.metadata,
      createdAt: creditTransactions.createdAt,
      customerName: customers.name,
      customerEmail: customers.email,
      productName: products.name,
    })
    .from(creditTransactions)
    .leftJoin(customers, eq(creditTransactions.customerId, customers.id))
    .leftJoin(products, eq(creditTransactions.productId, products.id))
    .where(and(eq(creditTransactions.balanceId, balanceId), eq(creditTransactions.organizationId, organizationId)))
    .orderBy(desc(creditTransactions.createdAt));
};

// TRANSACTIONS

export const postCreditTransaction = async (
  params: Omit<CreditTransaction, "id" | "organizationId" | "createdAt" | "updatedAt" | "environment">,
  organizationId: string,
  env: Network
) => {
  return await db
    .insert(creditTransactions)
    .values({
      ...params,
      id: generateResourceId("ct", organizationId, 20),
      organizationId: organizationId,
      environment: env,
    })
    .returning()
    .then(([creditTransaction]) => creditTransaction);
};

export const retrieveCreditTransaction = async (id: string, organizationId: string) => {
  return await db
    .select()
    .from(creditTransactions)
    .where(and(eq(creditTransactions.id, id), eq(creditTransactions.organizationId, organizationId)))
    .limit(1)
    .then(([creditTransaction]) => creditTransaction);
};

export const putCreditTransaction = async (id: string, returnUpdate: Partial<CreditTransaction>) => {
  return await db
    .update(creditTransactions)
    .set({ ...returnUpdate, updatedAt: new Date() })
    .where(eq(creditTransactions.id, id))
    .returning()
    .then(([record]) => record);
};

export const deleteCreditTransaction = async (id: string) => {
  return await db
    .delete(creditTransactions)
    .where(eq(creditTransactions.id, id))
    .returning()
    .then(() => null);
};
