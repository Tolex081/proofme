/**
 * Applies database migrations: `npm run db:migrate`.
 *
 * The hosted database is migrated only by this command, deliberately, never
 * as a side effect of serving a request. Safe to run twice: applied
 * migrations are skipped.
 */
import { describeTarget, loadLocalEnv, openDatabase } from "./lib/database.mjs";

loadLocalEnv();
console.log(`Migrating the ${describeTarget()}…`);
const { migrate, close } = await openDatabase();
try {
  await migrate();
  console.log("Migrations are up to date.");
} finally {
  await close();
}
