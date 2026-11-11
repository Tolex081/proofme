import base from "./playwright.config";

/** Captures review screenshots into .impeccable/review/. Not part of the test suite. */
const captureConfig = {
  ...base,
  testDir: "tests/capture",
  testMatch: /\.capture\.ts$/,
  projects: [{ name: "capture", use: { browserName: "chromium" as const } }],
};

export default captureConfig;
