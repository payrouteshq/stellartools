"use server";

import { resolveOrgContext } from "@/actions/organization";
import { Network, Product, ProductStatus, db, products } from "@/db";
import { uploadFiles } from "@/integrations/file-upload";
import { AppError } from "@/lib/action-handler";
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

  if (!Number.isInteger(params.priceCents) || params.priceCents <= 0) {
    throw new AppError("Price must be a positive integer in cents");
  }

  const [product] = await db
    .insert(products)
    .values({
      ...params,
      id: generateResourceId("prod", organizationId, 16),
      organizationId,
      environment,
    })
    .returning();

  return product;
};

export const retrieveProducts = async (
  orgId?: string,
  env?: Network,
  filters: { productId?: string; status?: ProductStatus } = {}
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const productsList = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.environment, environment),
        ...(filters.productId ? [eq(products.id, filters.productId)] : []),
        ...(filters.status ? [eq(products.status, filters.status)] : [])
      )
    );

  return productsList;
};

export const putProduct = async (id: string, organizationId: string, retUpdate: Partial<Product>) => {
  const [product] = await db
    .update(products)
    .set({ ...retUpdate, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .returning();

  if (!product) throw new AppError("Product not found");

  return product;
};

export const deleteProduct = async (id: string, organizationId: string) => {
  await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.organizationId, organizationId)))
    .returning();

  return null;
};
