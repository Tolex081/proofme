#!/usr/bin/env node
/**
 * Grants or removes platform administrator rights for one existing account.
 *
 *   npm run admin:grant -- someone@example.org
 *   npm run admin:grant -- someone@example.org --revoke
 *
 * Uses DATABASE_URL when set (hosted PostgreSQL), otherwise the local embedded
 * database in PGLITE_DATA_DIR (default .pglite). Stop the dev server first when
 * using the local database: only one process can open it at a time.
 *
 * Nothing in the web app can grant admin rights; this script is the only way.
 */
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*(#.*)?$/.exec(line);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
    }
  } catch {
    // No env file: rely on the real environment.
  }
}

loadEnvFile(".env.local");

const args = process.argv.slice(2);
const email = args
  .find((arg) => !arg.startsWith("--"))
  ?.trim()
  .toLowerCase();
const revoke = args.includes("--revoke");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: npm run admin:grant -- someone@example.org [--revoke]");
  process.exit(1);
}

const sql = "UPDATE users SET is_platform_admin = $1 WHERE lower(email) = $2 RETURNING id";
let rows;
if (process.env.DATABASE_URL) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  ({ rows } = await client.query(sql, [!revoke, email]));
  await client.end();
} else {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(process.env.PGLITE_DATA_DIR || ".pglite");
  ({ rows } = await db.query(sql, [!revoke, email]));
  await db.close();
}

if (rows.length === 0) {
  console.error(`No account with the email ${email}. Sign up first, then run this again.`);
  process.exit(1);
}
console.log(`${email} is ${revoke ? "no longer" : "now"} a platform administrator.`);
