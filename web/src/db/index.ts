import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

const sql = globalForDb.__sql ?? postgres(env.databaseUrl, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

export const db = drizzle(sql, { schema });
export { sql };
export * from "./schema";
