"use server";

import { retrieveAssets } from "@/actions/asset";
import { resolveOrgContext, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { Network, Product, ProductStatus, assets, db, products } from "@/db";
import { uploadFiles } from "@/integrations/file-upload";
import { createTrustlines } from "@/integrations/stellar-core";
import { AppError } from "@/lib/error-handler";
import { generateResourceId } from "@/lib/utils";
import { and, eq } from "drizzle-orm";

export const createProductImage = async (formData: FormData) => {
  const imageFiles = formData.getAll("images");

  if (imageFiles) {
    return (await uploadFiles(imageFiles as File[], { maxSizeKB: 1024 })) ?? [];
  }

  return undefined;
};

export const postProduct = async (
  params: Omit<Product, "id" | "organizationId" | "environment" | "assetId">,
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const [assets, { secret }] = await Promise.all([
    retrieveAssets(null, environment),
    retrieveOrganizationIdAndSecret(organizationId, environment),
  ]);

  const asset = assets.find((asset) => asset.code === params.assetCode);

  if (!asset) {
    throw new AppError(`Asset ${params.assetCode} not found`);
  }

  const [product] = await db
    .insert(products)
    .values({
      ...params,
      assetId: asset.id,
      id: generateResourceId("prod", organizationId, 16),
      organizationId,
      environment,
    })
    .returning();

  if (params.assetCode) {
    if (asset.issuer && asset.code !== "XLM" && secret?.publicKey) {
      createTrustlines(secret.publicKey, [{ code: asset.code, issuer: asset.issuer }], environment).catch((err) => {
        console.error("Failed to create trustline for asset", asset.code, asset.issuer, err);
      });
    }
  }

  return product;
};

export const retrieveProducts = async (
  orgId?: string,
  env?: Network,
  filters: { productId?: string; status?: ProductStatus } = {}
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const productsList = await db
    .select({
      product: products,
      asset: assets,
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.environment, environment),
        ...(filters.productId ? [eq(products.id, filters.productId)] : []),
        ...(filters.status ? [eq(products.status, filters.status)] : [])
      )
    )
    .innerJoin(assets, eq(products.assetId, assets.id));

  return productsList;
};

export const putProduct = async (id: string, organizationId: string, retUpdate: Partial<Product>) => {
  const [product] = await db
    .update(products)
    .set({ ...retUpdate, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .returning();

  if (!product) return;

  const [assets, { secret }] = await Promise.all([
    retrieveAssets({ id: retUpdate.assetId }, product.environment),
    retrieveOrganizationIdAndSecret(organizationId, product.environment),
  ]);

  const asset = assets.find((asset) => asset.code === retUpdate.assetCode);

  if (!asset) {
    throw new AppError(`Asset ${retUpdate.assetCode} not found`);
  }

  if (asset.issuer && asset.code !== "XLM" && secret?.publicKey) {
    createTrustlines(secret.publicKey, [{ code: asset.code, issuer: asset.issuer }], product.environment).catch(
      (err) => {
        console.error("Failed to create trustline for asset", asset.code, asset.issuer, err);
      }
    );
  }

  return product;
};

export const deleteProduct = async (id: string, organizationId: string) => {
  await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .returning();

  return null;
};
