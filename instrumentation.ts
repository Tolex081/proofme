/**
 * Runs once when the server starts. Opening the database (and, locally,
 * applying migrations to the embedded one) here means the first visitor does
 * not wait for it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { databaseReady } = await import("./lib/db/client");
    await databaseReady();
  }
}
