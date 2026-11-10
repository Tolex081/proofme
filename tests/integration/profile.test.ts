import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import {
  completeOnboarding,
  getProfileByUserId,
  getPublicProfile,
  isOnboarded,
  isUsernameAvailable,
  updateIdentity,
  updatePrivacy,
  updateProfile,
} from "@/server/services/profile";
import { createTestDatabase } from "./database";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const created = await createTestDatabase();
  db = created.db as unknown as Database;
  close = created.close;
});

afterAll(async () => {
  await close();
});

async function makeUser(name = "Test Person") {
  const id = `user_${randomUUID()}`;
  await db.insert(s.users).values({ id, name, email: `${id}@example.test` });
  return id;
}

const unique = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

function onboarding(username: string, overrides: Record<string, unknown> = {}) {
  return {
    intent: "contributor",
    displayName: "Daniel Okafor",
    username,
    bio: "",
    roles: ["developer"],
    ...overrides,
  };
}

async function onboardedUser(username = unique("person")) {
  const userId = await makeUser();
  const result = await completeOnboarding(db, userId, onboarding(username));
  if (!result.ok) throw new Error(`Onboarding failed: ${JSON.stringify(result.errors)}`);
  return { userId, username, profile: result.value };
}

const ALL_SECTIONS = { bio: true, location: true, links: true, skills: true, nearAccount: true };

describe("onboarding", () => {
  it("creates a private profile and records the starting preference", async () => {
    const userId = await makeUser("Placeholder");
    const username = unique("daniel");
    const result = await completeOnboarding(
      db,
      userId,
      onboarding(username, { intent: "both", bio: "  Builds review tools.  " }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibility).toBe("private");
    expect(result.value.onboardingIntent).toBe("both");
    expect(result.value.bio).toBe("Builds review tools.");
    expect(result.value.professionalCategories).toEqual(["developer"]);
    expect(isOnboarded(result.value)).toBe(true);

    const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
    expect(user.name).toBe("Daniel Okafor");
  });

  it("works with only the required fields", async () => {
    const userId = await makeUser();
    const result = await completeOnboarding(db, userId, {
      intent: "organisation",
      displayName: "Ada",
      username: unique("ada"),
      bio: "",
      roles: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.bio).toBeNull();
  });

  it("stores usernames in lowercase and treats case variants as the same name", async () => {
    const base = unique("mixed");
    const first = await completeOnboarding(db, await makeUser(), onboarding(base.toUpperCase()));
    expect(first.ok && first.value.username).toBe(base);
    const second = await completeOnboarding(db, await makeUser(), onboarding(base));
    expect(second).toEqual({
      ok: false,
      errors: { username: "That username is taken. Choose another." },
    });
  });

  it.each([
    ["ab", /at least 3/],
    ["-leading", /starting and ending/],
    ["trailing-", /starting and ending/],
    ["has space", /lowercase letters/],
    ["double--hyphen", /two hyphens/],
    ["admin", /reserved/],
    ["proofme", /reserved/],
    ["x".repeat(31), /at most 30/],
  ])("rejects the username %j", async (username, message) => {
    const result = await completeOnboarding(db, await makeUser(), onboarding(username));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.username).toMatch(message);
  });

  it("requires a display name and a starting preference", async () => {
    const result = await completeOnboarding(db, await makeUser(), {
      intent: "",
      displayName: "   ",
      username: unique("blank"),
      bio: "",
      roles: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.displayName).toBeDefined();
      expect(result.errors.intent).toBeDefined();
    }
  });

  it("cannot be run twice for the same account", async () => {
    const { userId } = await onboardedUser();
    const again = await completeOnboarding(db, userId, onboarding(unique("second")));
    expect(again.ok).toBe(false);
  });

  it("ignores fields a request should never be able to set", async () => {
    const userId = await makeUser();
    const result = await completeOnboarding(db, userId, {
      ...onboarding(unique("sneaky")),
      visibility: "public",
      userId: "someone-else",
      isPlatformAdmin: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.visibility).toBe("private");
      expect(result.value.userId).toBe(userId);
    }
    const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
    expect(user.isPlatformAdmin).toBe(false);
  });
});

describe("username availability", () => {
  it("reports taken, free, and one's own name correctly", async () => {
    const { userId, username } = await onboardedUser();
    expect(await isUsernameAvailable(db, username)).toBe(false);
    expect(await isUsernameAvailable(db, username.toUpperCase())).toBe(false);
    expect(await isUsernameAvailable(db, username, userId)).toBe(true);
    expect(await isUsernameAvailable(db, unique("free"))).toBe(true);
    expect(await isUsernameAvailable(db, "admin")).toBe(false);
    expect(await isUsernameAvailable(db, "no")).toBe(false);
  });
});

describe("updating a profile", () => {
  const edit = (username: string, overrides: Record<string, unknown> = {}) => ({
    displayName: "Daniel O.",
    username,
    bio: "Frontend engineer.",
    location: "Lagos",
    websiteUrl: "https://example.org/daniel",
    roles: ["developer", "designer"],
    skills: ["TypeScript", "React", "TypeScript"],
    ...overrides,
  });

  it("saves changes and reads them back", async () => {
    const { userId, username } = await onboardedUser();
    const result = await updateProfile(db, userId, edit(username));
    expect(result.ok).toBe(true);

    const stored = await getProfileByUserId(db, userId);
    expect(stored).toMatchObject({
      displayName: "Daniel O.",
      bio: "Frontend engineer.",
      location: "Lagos",
      websiteUrl: "https://example.org/daniel",
      professionalCategories: ["developer", "designer"],
      skills: ["TypeScript", "React"],
    });
  });

  it("only ever changes the acting user's own profile", async () => {
    const first = await onboardedUser();
    const second = await onboardedUser();
    await updateProfile(db, second.userId, edit(second.username, { displayName: "Second Person" }));

    const untouched = await getProfileByUserId(db, first.userId);
    expect(untouched?.displayName).toBe("Daniel Okafor");
    expect(untouched?.username).toBe(first.username);
  });

  it("refuses to take a username someone else holds, but keeps one's own", async () => {
    const first = await onboardedUser();
    const second = await onboardedUser();
    const stolen = await updateProfile(db, second.userId, edit(first.username));
    expect(stolen).toEqual({
      ok: false,
      errors: { username: "That username is taken. Choose another." },
    });
    expect((await updateProfile(db, second.userId, edit(second.username))).ok).toBe(true);
  });

  it.each([
    ["javascript:alert(1)"],
    ["http://example.org"],
    ["https://localhost/me"],
    ["not a link"],
  ])("rejects the website %j", async (websiteUrl) => {
    const { userId, username } = await onboardedUser();
    const result = await updateProfile(db, userId, edit(username, { websiteUrl }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.websiteUrl).toMatch(/https:\/\//);
  });

  it("limits roles and skills", async () => {
    const { userId, username } = await onboardedUser();
    const tooManyRoles = await updateProfile(
      db,
      userId,
      edit(username, { roles: ["developer", "designer", "writer", "mentor"] }),
    );
    expect(tooManyRoles.ok).toBe(false);
    const unknownRole = await updateProfile(db, userId, edit(username, { roles: ["wizard"] }));
    expect(unknownRole.ok).toBe(false);
    const tooManySkills = await updateProfile(
      db,
      userId,
      edit(username, { skills: Array.from({ length: 16 }, (_, index) => `skill-${index}`) }),
    );
    expect(tooManySkills.ok).toBe(false);
  });

  it("does nothing for an account with no profile", async () => {
    const result = await updateProfile(db, await makeUser(), edit(unique("ghost")));
    expect(result.ok).toBe(false);
  });
});

describe("identity links and NEAR account", () => {
  const blank = { github: "", x: "", linkedin: "", other: "", nearAccountId: "" };

  it("saves links on their own sites and a testnet account", async () => {
    const { userId } = await onboardedUser();
    const result = await updateIdentity(db, userId, {
      github: "https://github.com/daniel-okafor",
      x: "https://x.com/danielokafor",
      linkedin: "",
      other: "https://example.org/talks",
      nearAccountId: "Daniel-Okafor.testnet",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.socialLinks).toEqual({
      github: "https://github.com/daniel-okafor",
      x: "https://x.com/danielokafor",
      other: "https://example.org/talks",
    });
    expect(result.value.nearAccountId).toBe("daniel-okafor.testnet");
  });

  it("clears everything when the fields are emptied", async () => {
    const { userId } = await onboardedUser();
    await updateIdentity(db, userId, { ...blank, github: "https://github.com/someone" });
    const cleared = await updateIdentity(db, userId, blank);
    expect(cleared.ok && cleared.value.socialLinks).toEqual({});
    expect(cleared.ok && cleared.value.nearAccountId).toBeNull();
  });

  it("rejects a link that only pretends to be on the named site", async () => {
    const { userId } = await onboardedUser();
    for (const github of [
      "https://github.com.evil.example/daniel",
      "https://evil.example/github.com/daniel",
      "https://github.com@evil.example/daniel",
    ]) {
      const result = await updateIdentity(db, userId, { ...blank, github });
      expect(result.ok, github).toBe(false);
    }
  });

  it.each([
    ["daniel.near"],
    ["daniel"],
    ["Daniel Okafor.testnet"],
    ["-daniel.testnet"],
    ["daniel..testnet"],
    ["a".repeat(70) + ".testnet"],
    ["0x1234"],
  ])("rejects the NEAR account %j", async (nearAccountId) => {
    const { userId } = await onboardedUser();
    const result = await updateIdentity(db, userId, { ...blank, nearAccountId });
    expect(result.ok).toBe(false);
  });

  it("accepts a 64-character implicit account", async () => {
    const { userId } = await onboardedUser();
    const implicit = "ab".repeat(32);
    const result = await updateIdentity(db, userId, { ...blank, nearAccountId: implicit });
    expect(result.ok && result.value.nearAccountId).toBe(implicit);
  });
});

describe("public visibility", () => {
  async function publicUser() {
    const created = await onboardedUser();
    await updateProfile(db, created.userId, {
      displayName: "Daniel Okafor",
      username: created.username,
      bio: "Frontend engineer.",
      location: "Lagos",
      websiteUrl: "https://example.org/daniel",
      roles: ["developer"],
      skills: ["TypeScript"],
    });
    await updateIdentity(db, created.userId, {
      github: "https://github.com/daniel-okafor",
      x: "",
      linkedin: "",
      other: "",
      nearAccountId: "daniel-okafor.testnet",
    });
    await updatePrivacy(db, created.userId, { visibility: "public", sections: ALL_SECTIONS });
    return created;
  }

  it("shows nothing for a new profile, because profiles start private", async () => {
    const { username } = await onboardedUser();
    expect(await getPublicProfile(db, username)).toBeNull();
  });

  it("shows a profile once its owner makes it public, and hides it again on request", async () => {
    const { userId, username } = await publicUser();
    const visible = await getPublicProfile(db, username);
    expect(visible).toMatchObject({
      username,
      displayName: "Daniel Okafor",
      bio: "Frontend engineer.",
      location: "Lagos",
      nearAccountId: "daniel-okafor.testnet",
    });

    await updatePrivacy(db, userId, { visibility: "private", sections: ALL_SECTIONS });
    expect(await getPublicProfile(db, username)).toBeNull();
  });

  it("never exposes the account's email, user ID or internal fields", async () => {
    const { userId, username } = await publicUser();
    const visible = await getPublicProfile(db, username);
    const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
    const serialised = JSON.stringify(visible);
    expect(serialised).not.toContain(user.email);
    expect(serialised).not.toContain(userId);
    expect(Object.keys(visible ?? {})).not.toContain("onboardingIntent");
    expect(Object.keys(visible ?? {})).not.toContain("sectionVisibility");
  });

  it("leaves out each section the owner has hidden", async () => {
    const { userId, username } = await publicUser();
    await updatePrivacy(db, userId, {
      visibility: "public",
      sections: { bio: false, location: false, links: false, skills: false, nearAccount: false },
    });
    expect(await getPublicProfile(db, username)).toMatchObject({
      displayName: "Daniel Okafor",
      bio: null,
      location: null,
      websiteUrl: null,
      socialLinks: {},
      roles: [],
      skills: [],
      nearAccountId: null,
    });
  });

  it("hides the profile of a suspended account", async () => {
    const { userId, username } = await publicUser();
    await db.update(s.users).set({ status: "suspended" }).where(eq(s.users.id, userId));
    expect(await getPublicProfile(db, username)).toBeNull();
  });

  it("returns nothing for unknown or malformed usernames", async () => {
    expect(await getPublicProfile(db, unique("nobody"))).toBeNull();
    expect(await getPublicProfile(db, "'; DROP TABLE users; --")).toBeNull();
    expect(await getPublicProfile(db, "")).toBeNull();
  });

  it("records an audit event when visibility changes, and not otherwise", async () => {
    const { userId, profile } = await onboardedUser();
    const events = () =>
      db.select().from(s.auditEvents).where(eq(s.auditEvents.entityId, profile.id));

    await updatePrivacy(db, userId, { visibility: "public", sections: ALL_SECTIONS });
    expect(await events()).toHaveLength(1);
    expect((await events())[0]).toMatchObject({
      actorUserId: userId,
      action: "profile.visibility_changed",
      metadata: { from: "private", to: "public" },
    });

    await updatePrivacy(db, userId, {
      visibility: "public",
      sections: { ...ALL_SECTIONS, bio: false },
    });
    expect(await events()).toHaveLength(1);
  });

  it("rejects malformed privacy input", async () => {
    const { userId } = await onboardedUser();
    const result = await updatePrivacy(db, userId, { visibility: "everyone", sections: {} });
    expect(result.ok).toBe(false);
  });
});
