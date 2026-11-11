/**
 * Opens the configured database for command-line scripts, the same way the
 * app does: hosted PostgreSQL when DATABASE_URL is set, otherwise the local
 * embedded database in PGLITE_DATA_DIR (default .pglite).
 *
 * Stop the dev server before using the local database: only one process can
 * open it at a time.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";

import type { Database } from "../../lib/db/client";
import * as schema from "../../lib/db/schema";

const MIGRATIONS = "lib/db/migrations";

export function loadLocalEnv() {
  try {
    // Values already set in the real environment win over the file.
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local: rely on the real environment.
  }
}

export function appEnv(): string {
  return process.env.APP_ENV || "local";
}

/** Describes the target without revealing credentials. */
export function describeTarget(): string {
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      return `PostgreSQL at ${url.hostname}${url.pathname}`;
    } catch {
      return "PostgreSQL (DATABASE_URL)";
    }
  }
  return `local embedded database in ${process.env.PGLITE_DATA_DIR || ".pglite"}`;
}

export async function openDatabase(): Promise<{
  db: Database;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    const db = drizzleNodePg(pool, { schema });
    return {
      db: db as unknown as Database,
      migrate: () => migrateNodePg(db, { migrationsFolder: MIGRATIONS }),
      close: () => pool.end(),
    };
  }
  const client = new PGlite(process.env.PGLITE_DATA_DIR || ".pglite");
  const db = drizzlePglite(client, { schema });
  return {
    db: db as unknown as Database,
    migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS }),
    close: () => client.close(),
  };
}
