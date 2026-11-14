import { defineConfig } from "@playwright/test";

/** Capture the public Atesta demo page directly, without rebuilding the app. */
export default defineConfig({
  testDir: "tests/recording",
  testMatch: /demo\.record\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: "submission/build/raw",
  use: {
    browserName: "chromium",
    viewport: { width: 1536, height: 864 },
    video: { mode: "on", size: { width: 1536, height: 864 } },
    colorScheme: "light",
    locale: "en-GB",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
});
