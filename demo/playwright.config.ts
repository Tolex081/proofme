import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /walkthrough\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  outputDir: "demo/playwright-results",
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
