# ProofMe — full walkthrough: narration and scene plan

Target length: 5–8 minutes. Generated from `tests/recording/narration.ts`, which also
drives the recording, the voice track and the captions, so all four always match.

Everyone and everything shown is fictional demo data from `npm run db:seed`. The voice is the
offline Windows text-to-speech voice, not a person.

Lines marked **[NEAR]** are recorded only once the contract is on NEAR testnet and a real
token has been minted; until then they are left out of the video and its captions.

## 1. Product overview and roles

### Scene 1: overview

**On screen:** The home page, then How it works.

> ProofMe is a record of contributions to open projects, confirmed by the organisations that saw the work.
>
> There are three roles.
>
> Contributors describe their work and attach evidence.
>
> Organisations review those claims, and approve, question or decline them.
>
> And anyone can check a confirmed record, without an account.
>
> Each claim moves through clear states: self-reported, awaiting review, verified, or not approved.
>
> Everyone you will see in this video is fictional sample data, and ProofMe runs on NEAR testnet only.

## 2. Contributor registration and profile

### Scene 2: register

**On screen:** Registration, onboarding, and the privacy settings.

> Signing up needs only a name, an email and a password. No wallet is required to contribute.
>
> Onboarding asks for a display name, a username and a short bio.
>
> Profiles start private. The contributor decides when to make one public, and can hide individual sections.

### Scene 3: profile

**On screen:** Daniel Okafor's public profile.

> Here is a public profile for Daniel Okafor.
>
> Verified contributions come first, each naming the organisation that confirmed it.
>
> Self-reported work is shown separately, and clearly labelled as not confirmed by anyone.
>
> Links on the profile are marked as added by Daniel and not checked by ProofMe.

## 3. Contribution and evidence

### Scene 4: claim

**On screen:** Daniel signs in and writes a new contribution with evidence.

> Daniel signs in to add new work.
>
> A contribution has a title, a summary, a description, the kind of work, his role and the dates.
>
> Evidence is a list of links: pull requests, documents, demos.
>
> Every link is checked on the server. Only secure web addresses are accepted, and nothing is fetched from them.
>
> He saves a draft, which only he can see.

### Scene 5: send

**On screen:** Daniel sends the draft to Northstar Protocol for review.

> Then he chooses who should confirm it: Northstar Protocol's Open Grants Portal project.
>
> The claim is now awaiting review. He can withdraw it until a reviewer decides.

## 4. Organisation dashboard, projects and team

### Scene 6: org

**On screen:** Sam Adeyemi, Northstar's owner, in the organisation workspace: overview, projects, team.

> Now the organisation side. Sam owns Northstar Protocol, another fictional account.
>
> The organisation workspace shows open claims, projects and the team.
>
> Projects group the work a claim can be about.
>
> The team has four roles: owners, admins, reviewers and viewers.
>
> Only owners and admins invite people, and an invitation link works once, for the invited email, for seven days.
>
> Northstar has asked ProofMe to review who runs it. That platform review is separate from being a NEAR issuer, and the public page shows both.

## 5. Verification queue and decision

### Scene 7: queue

**On screen:** Priya opens the review queue and the claim.

> Priya is a reviewer at Northstar.
>
> Her queue lists the claims sent to the organisation.
>
> She sees the full claim and the evidence the contributor attached.
>
> She can approve it, ask for more information, or decline it with a reason the contributor will see.
>
> Internal notes stay inside the organisation.

### Scene 8: approve

**On screen:** Priya approves the claim.

> She approves.
>
> At that moment the claim is frozen into an attestation: a canonical JSON record, with a random value so it cannot be guessed, and its SHA-256 digest.
>
> A database rule stops anyone, administrators included, from editing it afterwards.

## 6. NEAR issuer and transaction approval

### Scene 9: issuer

**On screen:** Northstar's Attestations page, with the NEAR issuer panel.

> On the Attestations page, an owner connects the NEAR account that will issue for the organisation.
>
> That account is registered as an issuer on the ProofMe contract on NEAR testnet.
>
> Issuing an attestation mints a non-transferable NFT to the contributor, carrying only the attestation ID, the digest and the issuer. No names, emails or links go on-chain.
>
> ProofMe never sees a key or a seed phrase. Each transaction is shown and signed in the organisation's own wallet, and the server then confirms it from the contract before recording anything.

### Scene 10: mint **[NEAR]**

**On screen:** Sam issues the new attestation on NEAR testnet and approves it in the wallet.

> Here Sam issues the new attestation, and approves the transaction in the wallet.
>
> Once it is confirmed on testnet, the record shows the token and links to the transaction.

## 7. Attestation record and public verification

### Scene 11: verify

**On screen:** The public verification page.

> This is the public verification page, open to anyone.
>
> It shows who issued the record, who reviewed it, the claim as approved, and the evidence the reviewer was shown.
>
> Every time it loads, it hashes the stored record again and compares it with the digest.
>
> **[NEAR]** Then it reads the token from the NEAR contract live, and checks that the digest on-chain matches.
>
> **[without NEAR]** This one has not been issued on NEAR yet, and the page says so plainly, rather than implying it has.

## 8. Revocation and supersession

### Scene 12: revoke

**On screen:** Sam revokes an older attestation; the public record then shows it as revoked.

> Organisations can withdraw their word.
>
> Sam revokes an older attestation, with a reason the contributor will see.
>
> Revoking cannot be undone. The record stays public, marked as revoked, so nobody can quietly rewrite history.
>
> The contract also supports replacing a record with a corrected one, which then points to its successor.

## 9. Security, privacy and limitations

### Scene 13: admin

**On screen:** The platform admin area: organisation review, reports and the audit log.

> ProofMe administrators review organisations, handle reports and read the audit log.
>
> By design they cannot issue, edit or revoke an organisation's attestations.
>
> Every permission is checked on the server, never only in the interface.
>
> Sensitive actions are rate-limited and written to the audit log, and the site sends a strict content security policy.

### Scene 14: limits

**On screen:** Explore, then the privacy page.

> Private profiles, drafts and pending claims never appear in public search or on public pages.
>
> Current limitations: ProofMe runs on NEAR testnet only, email verification is not switched on yet, and there is no upload of files: evidence is links.

## 10. Future direction

### Scene 15: future

**On screen:** The home page.

> What comes next is future work, not part of this build.
>
> Richer credentials, such as skills endorsed across several organisations.
>
> And attestations about work done by AI agents, confirmed by the people responsible for them.
>
> ProofMe: your work, confirmed by the people who saw it.

---

About 804 words in the full version, roughly 309 seconds of speech at
the voice's pace, plus the time each action takes on screen.
