import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/lib/db/schema";

const MIGRATIONS = fileURLToPath(new URL("../../lib/db/migrations", import.meta.url));

/**
 * A fresh, in-memory PostgreSQL (PGlite) with every migration applied.
 * Each test file gets its own; nothing touches a shared or real database.
 */
export async function createTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db, client, close: () => client.close() };
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>["db"];
