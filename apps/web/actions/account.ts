"use server";

import { getCurrentUser } from "@/actions/auth";
import { AuthProvider } from "@/constant/schema.client";
import { Account, accounts, db, organizations } from "@/db";
import { getCookie } from "@/integrations/cookie-manager";
import { uploadFiles } from "@/integrations/file-upload";
import { AppError } from "@/lib/action-handler";
import { STELLARTOOLS_ID, verifyJwt } from "@stellartools/core";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export const postAccount = async (params: Partial<Account>) => {
  const [account] = await db
    .insert(accounts)
    .values({ id: `ac_${nanoid(25)}`, ...params } as Account)
    .returning();

  return account;
};

export type AccountLookup =
  | { id: string }
  | { email: string }
  | { sso: { provider: AuthProvider; sub: string } }
  | { accessToken: true }
  | { organizationId: string };

export const retrieveAccount = async (payload: AccountLookup): Promise<Account | null> => {
  let whereClause;

  if ("accessToken" in payload) {
    const accessToken = await getCookie("accessToken");
    if (!accessToken) return null;
    const { accountId } = verifyJwt<{ accountId: string }>(accessToken, process.env.JWT_SECRET!, STELLARTOOLS_ID);
    return await retrieveAccount({ id: accountId });
  }

  if ("sso" in payload) {
    whereClause = sql`EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(${accounts.sso}->'values') AS element 
      WHERE element->>'provider' = ${payload.sso.provider}::text 
        AND element->>'sub' = ${payload.sso.sub}::text
    )`;
  } else if ("id" in payload) {
    whereClause = eq(accounts.id, payload.id);
  } else if ("organizationId" in payload) {
    whereClause = eq(organizations.id, payload.organizationId);
    const [{ account }] = await db
      .select()
      .from(accounts)
      .innerJoin(organizations, eq(accounts.id, organizations.accountId))
      .where(whereClause)
      .limit(1);

    return account;
  } else {
    whereClause = eq(accounts.email, payload.email);
  }

  const [account] = await db.select().from(accounts).where(whereClause).limit(1);

  return account ?? null;
};

export const putAccount = async (id: string, params: Partial<Account>, options?: { formDataWithFiles?: FormData }) => {
  const avatarFile = options?.formDataWithFiles?.get("avatar");

  if (avatarFile) {
    const avatarUploadResult = await uploadFiles([avatarFile as File], { maxSizeKB: 48 });
    params.profile = { ...params.profile, avatarUrl: avatarUploadResult?.[0] };
  }

  const [account] = await db
    .update(accounts)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(accounts.id, id))
    .returning();

  if (!account) throw new AppError("Account not found");

  return account;
};

export const deleteAccount = async (id: string) => {
  await db.delete(accounts).where(eq(accounts.id, id)).returning();

  return null;
};

// -- Account Internal --

export const resolveAccountContext = async (accountId?: string) => {
  if (accountId) return { accountId };

  const account = await getCurrentUser();

  if (!account) throw new AppError("Account not found");

  return { accountId: account.id };
};
