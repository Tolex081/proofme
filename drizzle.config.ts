import { defineConfig } from "drizzle-kit";

// Used only to generate SQL migrations from the schema (`npm run db:generate`).
// Generating needs no database connection.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
});
