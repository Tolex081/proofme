/**
 * Loads the demo scenario: `npm run db:seed`.
 *
 * Everything here is fictional and labelled as demo data: the people, the
 * organisation and the project. Evidence links point at example.org, a domain
 * reserved for examples. The attestation is issued by the real review flow but
 * is NOT minted on NEAR: minting needs the organisation's own wallet, and a
 * transaction hash is never invented.
 *
 * Runs through the same services the app uses, so the data obeys every rule.
 * Refuses production. Running it twice does nothing the second time.
 *
 * Sign-in password for every demo account: DEMO_PASSWORD if set, otherwise a
 * random one printed once at the end. Never reuse a real password here.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import type { Database } from "../lib/db/client";
import * as s from "../lib/db/schema";
import { createContribution, publishSelfReported } from "../server/services/contributions";
import {
  createOrganisation,
  createProject,
  requestPlatformReview,
} from "../server/services/organisations";
import { completeOnboarding, updatePrivacy } from "../server/services/profile";
import { decide, submitForReview } from "../server/services/verification";
import { appEnv, describeTarget, loadLocalEnv, openDatabase } from "./lib/database.mjs";

loadLocalEnv();

if (appEnv() === "production") {
  console.error("Not seeding: APP_ENV is production. Demo data never goes into production.");
  process.exit(1);
}

const DOMAIN = "demo.proofme.test";
const SAMPLE = "Sample account for the ProofMe demo. This person is fictional.";
const password = process.env.DEMO_PASSWORD || `demo-${randomBytes(9).toString("base64url")}`;
if (password.length < 10) {
  console.error("DEMO_PASSWORD must be at least 10 characters.");
  process.exit(1);
}

function check<T>(result: { ok: true; value: T } | { ok: false; errors: Record<string, string> }) {
  if (!result.ok) throw new Error(`Seed step failed: ${JSON.stringify(result.errors)}`);
  return result.value;
}

async function person(
  db: Database,
  details: { name: string; email: string; username: string; bio: string; admin?: boolean },
) {
  const id = `demo_${randomUUID()}`;
  await db.insert(s.users).values({
    id,
    name: details.name,
    email: details.email,
    emailVerified: true,
    isPlatformAdmin: details.admin ?? false,
  });
  await db.insert(s.accounts).values({
    id: randomUUID(),
    userId: id,
    accountId: id,
    providerId: "credential",
    password: await hashPassword(password),
  });
  check(
    await completeOnboarding(db, id, {
      intent: "both",
      displayName: details.name,
      username: details.username,
      bio: details.bio,
      roles: [],
    }),
  );
  await updatePrivacy(db, id, {
    visibility: "public",
    sections: { bio: true, location: true, links: true, skills: true, nearAccount: true },
  });
  return id;
}

/**
 * Demo only: ProofMe's verification of the fictional Northstar Protocol, so
 * the demo organisation can pass the issuer policy. On a real deployment this
 * is a platform administrator's decision (/admin/organisations). Idempotent;
 * leaves an audit entry saying it came from the demo seed.
 */
async function verifyDemoOrganisation(db: Database) {
  const updated = await db
    .update(s.organisations)
    .set({ platformVerificationStatus: "verified" })
    .where(eq(s.organisations.slug, "northstar-protocol"))
    .returning({ id: s.organisations.id, before: s.organisations.platformVerificationStatus });
  const [organisation] = updated;
  if (!organisation) return;
  await db.insert(s.auditEvents).values({
    actorUserId: null,
    organisationId: organisation.id,
    action: "organisation.verified_by_demo_seed",
    entityType: "organisation",
    entityId: organisation.id,
    metadata: { note: "Fictional demo organisation, verified by the demo seed." },
  });
}

async function seed(db: Database) {
  const [existing] = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(eq(s.users.email, `daniel.okafor@${DOMAIN}`));
  if (existing) {
    const [northstar] = await db
      .select({ status: s.organisations.platformVerificationStatus })
      .from(s.organisations)
      .where(eq(s.organisations.slug, "northstar-protocol"));
    if (northstar && northstar.status !== "verified") {
      await verifyDemoOrganisation(db);
      console.log("Marked the demo organisation Northstar Protocol as verified.");
    }
    console.log("The demo data is already there. Run `npm run db:reset` first for a fresh copy.");
    return false;
  }

  const daniel = await person(db, {
    name: "Daniel Okafor",
    email: `daniel.okafor@${DOMAIN}`,
    username: "daniel-okafor",
    bio: `${SAMPLE} Frontend engineer who builds review tools.`,
  });
  const sam = await person(db, {
    name: "Sam Adeyemi",
    email: `sam.adeyemi@${DOMAIN}`,
    username: "sam-adeyemi",
    bio: `${SAMPLE} Owner of the demo organisation.`,
  });
  const priya = await person(db, {
    name: "Priya Raman",
    email: `priya.raman@${DOMAIN}`,
    username: "priya-raman",
    bio: `${SAMPLE} Reviews contributions for the demo organisation.`,
  });
  if (appEnv() === "local") {
    await person(db, {
      name: "Demo Administrator",
      email: `admin@${DOMAIN}`,
      username: "demo-admin",
      bio: `${SAMPLE} Platform administrator, local only.`,
      admin: true,
    });
  }

  const northstar = check(
    await createOrganisation(db, sam, {
      name: "Northstar Protocol",
      slug: "northstar-protocol",
      category: "web3_protocol",
      description:
        "Demo organisation. Northstar Protocol is fictional and is not a ProofMe partner; it exists to show how review works.",
      websiteUrl: "https://example.org/northstar-demo",
    }),
  );
  const portal = check(
    await createProject(db, sam, northstar.id, {
      name: "Open Grants Portal",
      description: "Demo project: a fictional portal for reviewing grant proposals.",
      websiteUrl: "",
      repositoryUrl: "",
      status: "active",
      startDate: "2026-06-01",
      endDate: "",
    }),
  );
  // A reviewer joins directly here; in the app this happens through an invitation link.
  await db
    .insert(s.organisationMembers)
    .values({ organisationId: northstar.id, userId: priya, role: "reviewer", status: "active" });
  check(await requestPlatformReview(db, sam, northstar.id));

  const verified = check(
    await createContribution(db, daniel, {
      title: "Implemented the proposal review interface",
      summary: "Built the screen reviewers use to read, score and comment on grant proposals.",
      description:
        "Designed and implemented the proposal review interface for the Open Grants Portal: a scoring form, inline comments and keyboard shortcuts for reviewers. Demo record.",
      category: "development",
      role: "Frontend engineer",
      skills: ["TypeScript", "React", "Accessibility"],
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      visibility: "public",
      evidence: [
        {
          type: "github_pr",
          url: "https://example.org/northstar-demo/portal/pull/42",
          label: "Demo pull request #42",
        },
      ],
    }),
  );
  const request = check(
    await submitForReview(db, daniel, verified.id, {
      organisationId: northstar.id,
      projectId: portal.id,
    }),
  );
  check(
    await decide(db, priya, request.requestId, {
      decision: "approve",
      message: "Thanks, Daniel. Confirmed against the demo pull request.",
      internalNote: "",
      expectedVersion: 0,
    }),
  );

  const selfReported = check(
    await createContribution(db, daniel, {
      title: "Wrote the contributor onboarding guide",
      summary: "A step-by-step guide for first-time contributors to the portal.",
      description: "Wrote and illustrated the onboarding guide. Demo record, not reviewed.",
      category: "content_documentation",
      role: "Writer",
      skills: ["Technical writing"],
      startDate: "2026-08-01",
      endDate: "2026-08-20",
      visibility: "public",
      evidence: [
        {
          type: "website",
          url: "https://example.org/northstar-demo/docs/onboarding",
          label: "Demo guide",
        },
      ],
    }),
  );
  check(await publishSelfReported(db, daniel, selfReported.id));
  await verifyDemoOrganisation(db);
  return true;
}

console.log(`Seeding demo data into the ${describeTarget()}…`);
const { db, migrate, close } = await openDatabase();
try {
  await migrate();
  if (await seed(db)) {
    console.log(`
Demo data loaded. Every account below is fictional; all use the same password.

  daniel.okafor@${DOMAIN}   contributor (one verified, one self-reported contribution)
  sam.adeyemi@${DOMAIN}     owner of Northstar Protocol (verified by the demo seed)
  priya.raman@${DOMAIN}     reviewer at Northstar Protocol${
    appEnv() === "local" ? `\n  admin@${DOMAIN}           platform administrator (local only)` : ""
  }

Password: ${process.env.DEMO_PASSWORD ? "the DEMO_PASSWORD you set" : password}
Public pages: /u/daniel-okafor and /org/northstar-protocol
To put the approved record on NEAR: Daniel proves his testnet account under Identity and agrees
to publish it; Sam proves the issuer account under Attestations; the contract owner registers that
account; then Sam issues it. No transaction hash is ever invented.`);
  }
} finally {
  await close();
}
