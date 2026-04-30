"use server";

import { retrieveAssets } from "@/actions/asset";
import { resolveOrgContext, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { Network, Product, ProductStatus, assets, db, products } from "@/db";
import { uploadFiles } from "@/integrations/file-upload";
import { createTrustlines } from "@/integrations/stellar-core";
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
  params: Omit<Product, "id" | "organizationId" | "environment">,
  orgId?: string,
  env?: Network
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  console.log({ params, organizationId, environment });

  const [product] = await db
    .insert(products)
    .values({ ...params, id: generateResourceId("prod", organizationId, 16), organizationId, environment })
    .returning();

  if (params.assetId) {
    console.log("creating trustline for asset", params.assetId);
    const [[asset], { secret }] = await Promise.all([
      retrieveAssets({ id: params.assetId }, environment),
      retrieveOrganizationIdAndSecret(organizationId, environment),
    ]);

    console.log({ asset, secret });

    if (asset && asset.issuer && asset.code !== "XLM" && secret?.publicKey) {
      // Fire and forget trustline creation
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

  if (retUpdate.assetId) {
    const [[asset], { secret }] = await Promise.all([
      retrieveAssets({ id: retUpdate.assetId }, product.environment),
      retrieveOrganizationIdAndSecret(organizationId, product.environment),
    ]);

    if (!asset || !asset?.issuer || !asset?.code || asset?.code === "XLM") return;

    if (secret?.publicKey) {
      createTrustlines(secret.publicKey, [{ code: asset.code, issuer: asset.issuer }], product.environment).catch(
        (err) => {
          console.error("Failed to create trustline for asset", asset.code, asset.issuer, err);
        }
      );
    }
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
