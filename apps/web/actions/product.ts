"use server";

import { paginate, parseOffset } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import { subscriptionPeriodMs } from "@/constant";
import { Network, Product, ProductStatus, db, products } from "@/db";
import { uploadFiles } from "@/integrations/file-upload";
import { AppError } from "@/lib/action-handler";
import { generateResourceId } from "@/lib/utils";
import { ApiListParams, PaginatedResult } from "@/types";
import { and, desc, eq } from "drizzle-orm";

const resolveSubscriptionBilling = (
  type: Product["type"],
  recurringPeriod: Product["recurringPeriod"],
  customDurationMs: Product["customDurationMs"]
) => {
  if (type !== "subscription") {
    return { recurringPeriod: null, customDurationMs: null };
  }

  if (!recurringPeriod) {
    throw new AppError("Subscription product requires a recurring period");
  }

  const ms = subscriptionPeriodMs(recurringPeriod, customDurationMs);
  if (!ms) {
    throw new AppError("Subscription product has an invalid billing period");
  }

  return { recurringPeriod, customDurationMs: ms };
};

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

  const billing = resolveSubscriptionBilling(params.type, params.recurringPeriod, params.customDurationMs);

  const [product] = await db
    .insert(products)
    .values({
      ...params,
      ...billing,
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
  filters: { productId?: string; status?: ProductStatus; requiresAuth?: boolean } & ApiListParams = {}
): Promise<PaginatedResult<Product>> => {
  const requiresAuth = filters?.requiresAuth ?? true;

  let orgContext: { organizationId: string; environment: Network } | undefined;

  if (requiresAuth) {
    const { organizationId, environment } = await resolveOrgContext(orgId, env);
    orgContext = { organizationId, environment };
  } else {
    orgContext = undefined;
  }

  const limit = filters?.limit ?? 10;
  const offset = await parseOffset(filters?.starting_after);

  const productsList = await db
    .select()
    .from(products)
    .where(
      and(
        ...(orgContext
          ? [eq(products.organizationId, orgContext.organizationId), eq(products.environment, orgContext.environment)]
          : []),
        ...(filters.productId ? [eq(products.id, filters.productId)] : []),
        ...(filters.status ? [eq(products.status, filters.status)] : [])
      )
    )
    .limit(limit + 1)
    .offset(offset)
    .orderBy(desc(products.createdAt));

  return await paginate(productsList, limit);
};

export const putProduct = async (id: string, orgId: string, env: Network, retUpdate: Partial<Product>) => {
  const [
    { organizationId },
    {
      data: [oldProduct],
    },
  ] = await Promise.all([resolveOrgContext(orgId, env), retrieveProducts(orgId, env, { productId: id })]);

  if (!oldProduct) throw new AppError("Product not found");

  const { metadata: metadataPatch, ...baseUpdate } = retUpdate;
  const type = baseUpdate.type ?? oldProduct.type;
  const recurringPeriod = baseUpdate.recurringPeriod ?? oldProduct.recurringPeriod;
  const customDurationMs = baseUpdate.customDurationMs ?? oldProduct.customDurationMs;
  const billing = resolveSubscriptionBilling(type, recurringPeriod, customDurationMs);

  const [product] = await db
    .update(products)
    .set({
      ...baseUpdate,
      ...billing,
      updatedAt: new Date(),
      ...(metadataPatch !== undefined ? { metadata: { ...(oldProduct.metadata ?? {}), ...metadataPatch } } : {}),
    })
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
