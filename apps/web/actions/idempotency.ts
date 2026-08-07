import "server-only";

import { db, idempotencyKeys } from "@/db";
import { and, eq, isNull } from "drizzle-orm";

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
