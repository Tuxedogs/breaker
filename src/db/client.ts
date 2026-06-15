import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL. Set it locally in .env.local and in Vercel environment variables.");
  }

  if (!dbInstance) {
    const queryClient = postgres(databaseUrl, {
      max: 1,
      ssl: "require",
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    dbInstance = drizzle(queryClient, { schema });
  }

  return dbInstance;
}
