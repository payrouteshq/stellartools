import { config } from "dotenv";
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

import * as schema from "./schema";

config({ path: ".env" });

export const txContext = new AsyncLocalStorage<any>();

const client = postgres(process.env.DATABASE_URL!);

export const rawDb = drizzle({ client, schema });
export * from "./schema";

export const db = new Proxy(rawDb, {
  get(target, prop) {
    const activeTx = txContext.getStore();
    return Reflect.get(activeTx ?? target, prop);
  },
}) as typeof rawDb;
