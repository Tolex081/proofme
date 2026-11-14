/**
 * The narration for both submission videos: one source for the scripts in
 * submission/, the synthetic voice track, the captions and the recorder.
 *
 * Each scene's `id` names the browser actions in the matching *.record.ts
 * file. A scene or sentence marked `near` needs the attestation contract on
 * NEAR testnet and a real minted token; it is left out until both exist, so
 * the videos never show or claim an on-chain step that did not happen.
 *
 * Everyone and everything shown is fictional demo data from `npm run db:seed`.
 */

export interface Sentence {
  text: string;
  /** Only spoken when the recording includes a real NEAR testnet mint. */
  near?: boolean;
}

export interface Scene {
  id: string;
  /** Chapter title, shown in the scripts. */
  chapter: string;
  /** What the viewer sees, for the scene plan. */
  shows: string;
  narration: (string | Sentence)[];
  /** The whole scene needs a real NEAR testnet mint. */
  near?: boolean;
}

export type VideoName = "demo" | "walkthrough";

export const VIDEOS: Record<VideoName, { title: string; target: string; scenes: Scene[] }> = {
  demo: {
    title: "Atesta — product demo",
    target: "90–150 seconds",
    scenes: [
      {
        id: "problem",
        chapter: "The problem",
        shows: "The Atesta home page.",
        narration: [
          "Work on open projects is scattered across repositories, chats and forums.",
          "Anyone can claim anything, and checking a claim means chasing people down.",
          "Atesta turns a contribution into a record, confirmed by the organisation that saw the work.",
        ],
      },
      {
        id: "profile",
        chapter: "A contributor's record",
        shows: "Daniel Okafor's public profile, scrolling from verified to self-reported work.",
        narration: [
          "This is Daniel Okafor, a sample contributor.",
          "His public profile keeps verified work apart from what he reports himself.",
          "Each verified item names the organisation that confirmed it, and links to a record anyone can check.",
        ],
      },
      {
        id: "claim",
        chapter: "Adding a contribution",
        shows: "Daniel signs in and fills in a new contribution with an evidence link.",
        narration: [
          "Daniel adds new work: what he did, his role, and a link to the evidence.",
          "It starts as a private draft. Nobody else can see it until he sends it.",
        ],
      },
      {
        id: "send",
        chapter: "Sending it for review",
        shows: "Daniel sends the claim to Northstar Protocol's Open Grants Portal project.",
        narration: [
          "He sends it to Northstar Protocol, a fictional organisation, to confirm.",
          "Only Northstar's reviewers will see it.",
        ],
      },
      {
        id: "queue",
        chapter: "The reviewer",
        shows: "Priya Raman, a reviewer, opens Northstar's review queue and the claim.",
        narration: [
          "Priya reviews for Northstar. The claim is waiting in her queue, with the evidence Daniel attached.",
          "Nobody can approve their own claim, and the server checks her role on every decision.",
        ],
      },
      {
        id: "approve",
        chapter: "Approval",
        shows: "Priya approves the claim with a short message.",
        narration: [
          "She approves it. The claim is frozen into an attestation: a canonical record and its SHA-256 digest.",
        ],
      },
      {
        id: "mint",
        chapter: "Issuing on NEAR",
        shows: "Northstar issues the attestation on NEAR testnet from its own wallet.",
        near: true,
        narration: [
          "Northstar then issues it on NEAR testnet as a non-transferable NFT.",
          "Atesta never holds a key. The organisation signs in its own wallet.",
        ],
      },
      {
        id: "verify",
        chapter: "Public verification",
        shows: "The public verification page for the new attestation.",
        narration: [
          "Anyone can open the public record.",
          "The page hashes the record again, to show it has not changed since approval.",
          {
            text: "It also reads the token live from the NEAR contract, with a link to the transaction.",
            near: true,
          },
        ],
      },
      {
        id: "close",
        chapter: "Close",
        shows: "Daniel's profile with the new verified contribution.",
        narration: [
          "Portable, accountable proof of contribution.",
          "Confirmed by the people who saw the work, and checkable by anyone.",
        ],
      },
    ],
  },

  walkthrough: {
    title: "Atesta — full walkthrough",
    target: "5–8 minutes",
    scenes: [
      {
        id: "overview",
        chapter: "1. Product overview and roles",
        shows: "The home page, then How it works.",
        narration: [
          "Atesta is a record of contributions to open projects, confirmed by the organisations that saw the work.",
          "There are three roles.",
          "Contributors describe their work and attach evidence.",
          "Organisations review those claims, and approve, question or decline them.",
          "And anyone can check a confirmed record, without an account.",
          "Each claim moves through clear states: self-reported, awaiting review, verified, or not approved.",
          "Everyone you will see in this video is fictional sample data, and Atesta runs on NEAR testnet only.",
        ],
      },
      {
        id: "register",
        chapter: "2. Contributor registration and profile",
        shows: "Registration, onboarding, and the privacy settings.",
        narration: [
          "Signing up needs only a name, an email and a password. No wallet is required to contribute.",
          "Onboarding asks for a display name, a username and a short bio.",
          "Profiles start private. The contributor decides when to make one public, and can hide individual sections.",
        ],
      },
      {
        id: "profile",
        chapter: "2. Contributor registration and profile",
        shows: "Daniel Okafor's public profile.",
        narration: [
          "Here is a public profile for Daniel Okafor.",
          "Verified contributions come first, each naming the organisation that confirmed it.",
          "Self-reported work is shown separately, and clearly labelled as not confirmed by anyone.",
          "Links on the profile are marked as added by Daniel and not checked by Atesta.",
        ],
      },
      {
        id: "claim",
        chapter: "3. Contribution and evidence",
        shows: "Daniel signs in and writes a new contribution with evidence.",
        narration: [
          "Daniel signs in to add new work.",
          "A contribution has a title, a summary, a description, the kind of work, his role and the dates.",
          "Evidence is a list of links: pull requests, documents, demos.",
          "Every link is checked on the server. Only secure web addresses are accepted, and nothing is fetched from them.",
          "He saves a draft, which only he can see.",
        ],
      },
      {
        id: "send",
        chapter: "3. Contribution and evidence",
        shows: "Daniel sends the draft to Northstar Protocol for review.",
        narration: [
          "Then he chooses who should confirm it: Northstar Protocol's Open Grants Portal project.",
          "The claim is now awaiting review. He can withdraw it until a reviewer decides.",
        ],
      },
      {
        id: "org",
        chapter: "4. Organisation dashboard, projects and team",
        shows:
          "Sam Adeyemi, Northstar's owner, in the organisation workspace: overview, projects, team.",
        narration: [
          "Now the organisation side. Sam owns Northstar Protocol, another fictional account.",
          "The organisation workspace shows open claims, projects and the team.",
          "Projects group the work a claim can be about.",
          "The team has four roles: owners, admins, reviewers and viewers.",
          "Only owners and admins invite people, and an invitation link works once, for the invited email, for seven days.",
          "Northstar has asked Atesta to review who runs it. That platform review is separate from being a NEAR issuer, and the public page shows both.",
        ],
      },
      {
        id: "queue",
        chapter: "5. Verification queue and decision",
        shows: "Priya opens the review queue and the claim.",
        narration: [
          "Priya is a reviewer at Northstar.",
          "Her queue lists the claims sent to the organisation.",
          "She sees the full claim and the evidence the contributor attached.",
          "She can approve it, ask for more information, or decline it with a reason the contributor will see.",
          "Internal notes stay inside the organisation.",
        ],
      },
      {
        id: "approve",
        chapter: "5. Verification queue and decision",
        shows: "Priya approves the claim.",
        narration: [
          "She approves.",
          "At that moment the claim is frozen into an attestation: a canonical JSON record, with a random value so it cannot be guessed, and its SHA-256 digest.",
          "A database rule stops anyone, administrators included, from editing it afterwards.",
        ],
      },
      {
        id: "issuer",
        chapter: "6. NEAR issuer and transaction approval",
        shows: "Northstar's Attestations page, with the NEAR issuer panel.",
        narration: [
          "On the Attestations page, an owner connects the NEAR account that will issue for the organisation.",
          "That account is registered as an issuer on the Atesta contract on NEAR testnet.",
          "Issuing an attestation mints a non-transferable NFT to the contributor, carrying only the attestation ID, the digest and the issuer. No names, emails or links go on-chain.",
          "Atesta never sees a key or a seed phrase. Each transaction is shown and signed in the organisation's own wallet, and the server then confirms it from the contract before recording anything.",
        ],
      },
      {
        id: "mint",
        chapter: "6. NEAR issuer and transaction approval",
        shows: "Sam issues the new attestation on NEAR testnet and approves it in the wallet.",
        near: true,
        narration: [
          "Here Sam issues the new attestation, and approves the transaction in the wallet.",
          "Once it is confirmed on testnet, the record shows the token and links to the transaction.",
        ],
      },
      {
        id: "verify",
        chapter: "7. Attestation record and public verification",
        shows: "The public verification page.",
        narration: [
          "This is the public verification page, open to anyone.",
          "It shows who issued the record, who reviewed it, the claim as approved, and the evidence the reviewer was shown.",
          "Every time it loads, it hashes the stored record again and compares it with the digest.",
          {
            text: "Then it reads the token from the NEAR contract live, and checks that the digest on-chain matches.",
            near: true,
          },
          {
            text: "This one has not been issued on NEAR yet, and the page says so plainly, rather than implying it has.",
            near: false,
          },
        ],
      },
      {
        id: "revoke",
        chapter: "8. Revocation and supersession",
        shows: "Sam revokes an older attestation; the public record then shows it as revoked.",
        narration: [
          "Organisations can withdraw their word.",
          "Sam revokes an older attestation, with a reason the contributor will see.",
          "Revoking cannot be undone. The record stays public, marked as revoked, so nobody can quietly rewrite history.",
          "The contract also supports replacing a record with a corrected one, which then points to its successor.",
        ],
      },
      {
        id: "admin",
        chapter: "9. Security, privacy and limitations",
        shows: "The platform admin area: organisation review, reports and the audit log.",
        narration: [
          "Atesta administrators review organisations, handle reports and read the audit log.",
          "By design they cannot issue, edit or revoke an organisation's attestations.",
          "Every permission is checked on the server, never only in the interface.",
          "Sensitive actions are rate-limited and written to the audit log, and the site sends a strict content security policy.",
        ],
      },
      {
        id: "limits",
        chapter: "9. Security, privacy and limitations",
        shows: "Explore, then the privacy page.",
        narration: [
          "Private profiles, drafts and pending claims never appear in public search or on public pages.",
          "Current limitations: Atesta runs on NEAR testnet only, email verification is not switched on yet, and there is no upload of files: evidence is links.",
        ],
      },
      {
        id: "future",
        chapter: "10. Future direction",
        shows: "The home page.",
        narration: [
          "What comes next is future work, not part of this build.",
          "Richer credentials, such as skills endorsed across several organisations.",
          "And attestations about work done by AI agents, confirmed by the people responsible for them.",
          "Atesta: your work, confirmed by the people who saw it.",
        ],
      },
    ],
  },
};

/** The sentences actually spoken, given whether a real NEAR mint is included. */
export function spoken(scene: Scene, withNear: boolean): string[] {
  return scene.narration
    .filter((item) => {
      if (typeof item === "string") return true;
      return item.near === undefined ? true : item.near === withNear;
    })
    .map((item) => (typeof item === "string" ? item : item.text));
}

export function scenesFor(video: VideoName, withNear: boolean): Scene[] {
  return VIDEOS[video].scenes.filter((scene) => withNear || !scene.near);
}
