import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

const SECRET = "x".repeat(40);
const hosted = {
  APP_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://proofme.example.org",
  DATABASE_URL: "postgres://user:pass@db.example.org/proofme",
  BETTER_AUTH_SECRET: SECRET,
};

describe("environment separation", () => {
  it("runs locally with only a secret", () => {
    const env = parseEnv({ BETTER_AUTH_SECRET: SECRET });
    expect(env.APP_ENV).toBe("local");
    expect(env.NEAR_NETWORK).toBe("testnet");
  });

  it("accepts a complete hosted configuration", () => {
    expect(parseEnv(hosted).APP_ENV).toBe("production");
    expect(parseEnv({ ...hosted, APP_ENV: "preview" }).APP_ENV).toBe("preview");
  });

  it("refuses hosted environments without a real database", () => {
    expect(() => parseEnv({ ...hosted, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("refuses hosted environments on a local or plain-http address", () => {
    expect(() =>
      parseEnv({ ...hosted, NEXT_PUBLIC_APP_URL: "http://proofme.example.org" }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => parseEnv({ ...hosted, NEXT_PUBLIC_APP_URL: "https://localhost:3000" })).toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
  });

  it("never accepts mainnet, and hosted environments use testnet", () => {
    expect(() => parseEnv({ ...hosted, NEAR_NETWORK: "mainnet" })).toThrow(/NEAR_NETWORK/);
    expect(() => parseEnv({ ...hosted, NEAR_NETWORK: "sandbox" })).toThrow(/NEAR_NETWORK/);
  });

  it("requires a long secret and never echoes values in its errors", () => {
    let message = "";
    try {
      parseEnv({ ...hosted, BETTER_AUTH_SECRET: "short-secret-value" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/BETTER_AUTH_SECRET/);
    expect(message).not.toContain("short-secret-value");
    expect(message).not.toContain("user:pass");
  });
});
