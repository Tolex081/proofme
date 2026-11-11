import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * End-to-end tests run against a production build with an in-memory database,
 * so every run starts empty and nothing touches the local development data.
 * The secret below exists only for this throwaway test server.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    colorScheme: "light",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile.spec.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: BASE_URL,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      APP_ENV: "local",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      PGLITE_DATA_DIR: "memory://",
      DATABASE_URL: "",
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
      PROOFME_LOCAL_ADMIN_EMAIL: "e2e-admin@example.test",
    },
  },
});
