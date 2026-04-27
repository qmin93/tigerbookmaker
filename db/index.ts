// Drizzle DB 클라이언트 (Vercel Postgres 위)
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "./schema";

export const db = drizzle(sql, { schema });
export * from "./schema";
