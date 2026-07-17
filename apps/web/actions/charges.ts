"use server";

import { paginate, parseOffset } from "@/actions/event";
import { resolveOrgContext } from "@/actions/organization";
import { db } from "@/db";
import { Charge, ChargeStatus, ChargeType, charges } from "@/db/schema";
import { ApiListParams } from "@/types";
import { Network } from "@stellartools/core";
import { and, eq } from "drizzle-orm";

export const retrieveCharges = async (
  orgId?: string,
  env?: Network,
  filter?: {
    chargeId?: string;
    paymentId?: string;
    status?: ChargeStatus;
    type?: ChargeType;
  },
  params?: ApiListParams
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const limit = params?.limit ?? 10;
  const offset = await parseOffset(params?.starting_after);

  const query = db
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.organizationId, organizationId),
        eq(charges.environment, environment),
        filter?.chargeId ? eq(charges.id, filter.chargeId) : undefined,
        filter?.paymentId ? eq(charges.paymentId, filter.paymentId) : undefined,
        filter?.status ? eq(charges.status, filter.status) : undefined,
        filter?.type ? eq(charges.type, filter.type) : undefined
      )
    );

  const rows = await query.limit(limit + 1).offset(offset);

  return await paginate(rows, limit);
};

export const postCharge = async (
  params: Omit<Charge, "organizationId" | "environment" | "createdAt" | "updatedAt">,
  orgId?: string,
  env?: Network,
  hooks?: { onConflict: "do_nothing" }
) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  const query = db
    .insert(charges)
    .values({ ...params, organizationId, environment, createdAt: new Date(), updatedAt: new Date() });

  if (hooks?.onConflict === "do_nothing") {
    await query.onConflictDoNothing().returning();
  }

  return await query.returning();
};

export const putCharge = async (id: string, params: Partial<Charge>, orgId?: string, env?: Network) => {
  const { organizationId, environment } = await resolveOrgContext(orgId, env);

  return await db
    .update(charges)
    .set(params)
    .where(and(eq(charges.id, id), eq(charges.organizationId, organizationId), eq(charges.environment, environment)));
};
