/**
 * Vercel runs this instead of `next build` (the `vercel-build` npm script).
 *
 * 1. Applies database migrations to the hosted database. Vercel provides
 *    DATABASE_URL to the build, so the connection string never has to leave
 *    Vercel. Applied migrations are skipped, so this is safe on every build.
 * 2. Loads the fictional demo data, only when PROOFME_DEMO_SEED=1 is set for
 *    that environment. The seed itself refuses APP_ENV=production and does
 *    nothing if the data is already there.
 * 3. Builds the app.
 */
import { execSync } from "node:child_process";

function run(command: string) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit" });
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set for this Vercel environment. Connect the database first.");
  process.exit(1);
}

run("npx tsx scripts/migrate.mts");
if (process.env.PROOFME_DEMO_SEED === "1") {
  if (!process.env.DEMO_PASSWORD) {
    console.error("Set DEMO_PASSWORD in Vercel before seeding, so no password is printed in logs.");
    process.exit(1);
  }
  run("npx tsx scripts/seed-demo.mts");
}
run("npx next build");
