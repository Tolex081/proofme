import { defineConfig } from "@playwright/test";

/**
 * Records the submission videos from a production build of the real app,
 * with a fresh local database holding only the fictional demo data.
 * Not part of the test suite: run through `npm run video:record -- <video>`.
 */
const PORT = 3200;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/recording",
  testMatch: /\.record\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 15 * 60_000,
  expect: { timeout: 15_000 },
  outputDir: "submission/build/raw",
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    // Recorded at 1536 x 864 (larger text than a 1920px layout); the encoder
    // scales it to 1920 x 1080.
    viewport: { width: 1536, height: 864 },
    video: { mode: "on", size: { width: 1536, height: 864 } },
    colorScheme: "light",
    locale: "en-GB",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command:
      "npx tsx scripts/reset-local.mts && npx tsx scripts/seed-demo.mts && npx next build && npx next start -p " +
      PORT,
    url: BASE_URL,
    timeout: 400_000,
    reuseExistingServer: false,
    env: {
      APP_ENV: "local",
      NEXT_PUBLIC_APP_URL: BASE_URL,
      PGLITE_DATA_DIR: ".pglite-recording",
      DATABASE_URL: "",
      DEMO_PASSWORD: "recording-only-password-0000",
      BETTER_AUTH_SECRET: "recording-only-secret-not-used-anywhere-else-01234",
    },
  },
});
