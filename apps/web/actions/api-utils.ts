import "server-only";

import { db, idempotencyKeys, rateLimits } from "@/db";
import { AppError } from "@/lib/action-handler";
import { and, eq, isNull, sql } from "drizzle-orm";

// -- IDEMPOTENCY --

export async function getStoredResponse(key: string, orgId: string) {
  return await db.query.idempotencyKeys.findFirst({
    where: and(eq(idempotencyKeys.id, key), eq(idempotencyKeys.organizationId, orgId)),
  });
}

export async function saveIdempotencyResult(key: string, orgId: string, status: number, body: any) {
  await db
    .update(idempotencyKeys)
    .set({
      responseStatus: status,
      responseBody: body,
      lockedAt: null, // Release the lock
    })
    .where(and(eq(idempotencyKeys.id, key), eq(idempotencyKeys.organizationId, orgId)));
}

export async function releaseIdempotencyLock(key: string, orgId: string) {
  await db
    .delete(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.id, key),
        eq(idempotencyKeys.organizationId, orgId),
        isNull(idempotencyKeys.responseStatus)
      )
    );
}

// Atomic "Lock" to prevent two identical requests from running at the same time
export async function tryAcquireLock(key: string, orgId: string, path: string) {
  try {
    return await db
      .insert(idempotencyKeys)
      .values({
        id: key,
        organizationId: orgId,
        requestPath: path,
        lockedAt: new Date(),
      })
      .returning();
  } catch (e) {
    return null; // Lock failed (key already exists)
  }
}

// -- RATE LIMITING --

export async function consumeRateLimit(organizationId: string, limit: number, scope?: string) {
  // 1. Create a key for the current minute (e.g., "org_abc:2024-07-03T14:50")
  const now = new Date();
  const minuteKey = `${organizationId}:${now.toISOString().substring(0, 16)}`;
  const resetAt = new Date(now.getTime() + 60000);

  // 2. Atomic Upsert: If the row exists, increment count. If not, create it.
  const [row] = await db
    .insert(rateLimits)
    .values({ id: minuteKey, organizationId, count: 1, resetAt })
    .onConflictDoUpdate({
      target: [rateLimits.id],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning();

  const remaining = Math.max(0, limit - row.count);

  if (row.count > limit) {
    throw new AppError(
      "TOO_MANY_REQUESTS",
      `Rate limit exceeded. Maximum ${limit} requests per minute for ${scope}`,
      429
    );
  }

  return {
    limit,
    remaining,
    reset: row.resetAt,
  };
}
