import { creditTransactions, db } from "@/db";
import { apiHandler } from "@/lib/api-handler";
import { Result, z as Schema } from "@stellartools/core";
import { and, desc, eq } from "drizzle-orm";

export const GET = apiHandler({
  auth: ["apikey", "session"],
  schema: {
    params: Schema.object({ customerId: Schema.string() }),
    query: Schema.object({
      product_id: Schema.string().optional(),
      limit: Schema.coerce.number().default(50),
      offset: Schema.coerce.number().default(0),
    }),
  },
  handler: async ({ params, query, auth }) => {
    const { organizationId } = auth;
    const limit = Math.min(query.limit, 100);

    const conditions = [
      eq(creditTransactions.customerId, params.customerId),
      eq(creditTransactions.organizationId, organizationId),
      query.product_id ? eq(creditTransactions.productId, query.product_id) : undefined,
    ].filter(Boolean);

    const data = await db
      .select()
      .from(creditTransactions)
      .where(and(...conditions))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit + 1)
      .offset(query.offset);

    const has_more = data.length > limit;
    const results = has_more ? data.slice(0, limit) : data;

    return Result.ok({ data: results, has_more });
  },
});
