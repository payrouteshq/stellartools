"use server";

import { Network, db, supportedAssets } from "@/db";
import { AppError, safeAction } from "@/lib/action-handler";
import { SQL, and, arrayContains, eq, inArray } from "drizzle-orm";

export const retrieveSupportedAssets = safeAction(
  async (
    lookUpKey:
      | { id?: string }
      | { code?: string }
      | { issuers?: string[] }
      | { code?: string; issuers?: string[] }
      | { codes?: string[] }
      | null,
    environment: Network
  ) => {
    let whereClause: SQL | undefined;

    if (!lookUpKey) whereClause = undefined;
    else if ("id" in lookUpKey) {
      whereClause = eq(supportedAssets.id, lookUpKey.id!);
    } else if ("code" in lookUpKey && "issuers" in lookUpKey) {
      whereClause = and(
        eq(supportedAssets.code, lookUpKey.code!),
        arrayContains(supportedAssets.issuers, lookUpKey.issuers!)
      ) as SQL;
    } else if ("codes" in lookUpKey) {
      whereClause = inArray(supportedAssets.code, lookUpKey.codes!);
    } else if ("code" in lookUpKey) {
      whereClause = eq(supportedAssets.code, lookUpKey.code!);
    } else if ("issuers" in lookUpKey) {
      whereClause = arrayContains(supportedAssets.issuers, lookUpKey.issuers!) as SQL;
    } else {
      throw new AppError("Invalid lookup key. Must provide either id or code and issuer.");
    }

    return await db
      .select()
      .from(supportedAssets)
      .where(and(whereClause, eq(supportedAssets.environment, environment)));
  }
);
