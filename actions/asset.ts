"use server";

import { resolveOrgContext } from "@/actions/organization";
import { Asset, Network, assets, db, products } from "@/db";
import { AppError } from "@/lib/action-handler";
import { SQL, and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

export const postAsset = async (asset: Partial<Asset>) => {
  const [newAsset] = await db
    .insert(assets)
    .values({ id: `ast_${nanoid(25)}`, ...asset } as Asset)
    .returning();

  if (!newAsset) throw new AppError("Failed to create asset");

  return newAsset;
};

export const retrieveAssets = async (
  lookUpKey:
    | { id?: string }
    | { code?: string }
    | { issuer?: string }
    | { code?: string; issuer?: string }
    | { codes?: string[] }
    | null,
  environment: Network
) => {
  let whereClause: SQL | undefined;
  if (!lookUpKey) whereClause = undefined;
  else if ("id" in lookUpKey) {
    whereClause = eq(assets.id, lookUpKey.id!);
  } else if ("code" in lookUpKey && "issuer" in lookUpKey) {
    whereClause = and(eq(assets.code, lookUpKey.code!), eq(assets.issuer, lookUpKey.issuer!)) as SQL;
  } else if ("codes" in lookUpKey) {
    whereClause = inArray(assets.code, lookUpKey.codes!);
  } else if ("code" in lookUpKey) {
    whereClause = eq(assets.code, lookUpKey.code!);
  } else if ("issuer" in lookUpKey) {
    whereClause = eq(assets.issuer, lookUpKey.issuer!);
  } else {
    throw new AppError("Invalid lookup key. Must provide either id or code and issuer.");
  }

  return await db
    .select()
    .from(assets)
    .where(and(whereClause, eq(assets.environment, environment)));
};

export const retrieveAssetsFromProducts = async (orgId?: string, env?: Network): Promise<Asset[]> => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const rows = await db
    .select({ assetId: products.assetId })
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.environment, environment)));

  const ids = [...new Set(rows.map((r) => r.assetId).filter(Boolean))] as string[];

  if (ids.length === 0) return [];

  return await db.select().from(assets).where(inArray(assets.id, ids));
};

export const putAsset = async (id: string, asset: Partial<Asset>) => {
  const [updatedAsset] = await db
    .update(assets)
    .set({ ...asset, updatedAt: new Date() })
    .where(eq(assets.id, id))
    .returning();

  if (!updatedAsset) throw new AppError("Failed to update asset");

  return updatedAsset as Asset;
};

export const deleteAsset = async (id: string) => {
  await db.delete(assets).where(eq(assets.id, id)).returning();

  return null;
};
