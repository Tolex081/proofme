import "server-only";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";

import { getEnv } from "../env";
import * as schema from "./schema";

/** The database type every service is written against, whichever driver backs it. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

interface Connection {
  db: Database;
  ready: Promise<void>;
}

// One connection per server process. The global survives development reloads,
// which would otherwise open the embedded database twice.
const globalStore = globalThis as typeof globalThis & { __proofmeDb?: Connection };

function connect(): Connection {
  const env = getEnv();

  if (env.DATABASE_URL) {
    // Hosted PostgreSQL. Migrations are applied deliberately with
    // `npm run db:migrate`, never as a side effect of serving a request.
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
    return {
      db: drizzleNodePg(pool, { schema }) as unknown as Database,
      ready: Promise.resolve(),
    };
  }

  // Local development and automated tests: an embedded PostgreSQL. Its
  // migrations are applied on start so a fresh checkout works immediately.
  const inMemory = env.PGLITE_DATA_DIR === "memory://";
  // Paths are relative to the working directory (the project root). They are
  // left as plain strings so the production build does not trace the project.
  const client = inMemory ? new PGlite() : new PGlite(env.PGLITE_DATA_DIR);
  const db = drizzlePglite(client, { schema });
  const ready = migratePglite(db, { migrationsFolder: "lib/db/migrations" });
  return { db: db as unknown as Database, ready };
}

function connection(): Connection {
  if (!globalStore.__proofmeDb) {
    const created = connect();
    // A failed start is not cached: the next request tries again.
    created.ready.catch(() => {
      if (globalStore.__proofmeDb === created) globalStore.__proofmeDb = undefined;
    });
    globalStore.__proofmeDb = created;
  }
  return globalStore.__proofmeDb;
}

/** The database, once it is ready to be queried. */
export async function getDb(): Promise<Database> {
  const current = connection();
  await current.ready;
  return current.db;
}

/**
 * The database handle without waiting. Only for libraries that need the handle
 * at configuration time; callers must await `databaseReady()` before any query.
 */
export function getDbHandle(): Database {
  return connection().db;
}

export function databaseReady(): Promise<void> {
  return connection().ready;
}
