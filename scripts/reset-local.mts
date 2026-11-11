/**
 * Deletes the local embedded database: `npm run db:reset`.
 *
 * Refuses to run against anything but the local embedded database, so it can
 * never touch a hosted one. Stop the dev server first. Then run
 * `npm run db:seed` for fresh demo data, or start the app for an empty one.
 */
import { existsSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";

import { appEnv, loadLocalEnv } from "./lib/database.mjs";

loadLocalEnv();

function refuse(reason: string): never {
  console.error(`Not resetting: ${reason}`);
  process.exit(1);
}

if (appEnv() !== "local") refuse(`APP_ENV is "${appEnv()}". This only resets local data.`);
if (process.env.DATABASE_URL) refuse("DATABASE_URL is set. This never touches a hosted database.");

const directory = process.env.PGLITE_DATA_DIR || ".pglite";
if (directory.includes("://")) refuse(`PGLITE_DATA_DIR is "${directory}", which keeps nothing.`);
const target = resolve(directory);
const root = resolve(".");
if (!target.startsWith(root + sep)) refuse("PGLITE_DATA_DIR must be inside the project folder.");

if (!existsSync(target)) {
  console.log(`Nothing to reset: ${directory} does not exist.`);
} else {
  rmSync(target, { recursive: true, force: true });
  console.log(`Deleted the local database in ${directory}.`);
}
