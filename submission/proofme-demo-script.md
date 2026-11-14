# Atesta — product demo: narration and scene plan

Target length: 90–150 seconds. Generated from `tests/recording/narration.ts`, which also
drives the recording, the voice track and the captions, so all four always match.

Everyone and everything shown is fictional demo data from `npm run db:seed`. The voice is the
offline Windows text-to-speech voice, not a person.

Lines marked **[NEAR]** are recorded only once the contract is on NEAR testnet and a real
token has been minted; until then they are left out of the video and its captions.

## The problem

### Scene 1: problem

**On screen:** The Atesta home page.

> Work on open projects is scattered across repositories, chats and forums.
>
> Anyone can claim anything, and checking a claim means chasing people down.
>
> Atesta turns a contribution into a record, confirmed by the organisation that saw the work.

## A contributor's record

### Scene 2: profile

**On screen:** Daniel Okafor's public profile, scrolling from verified to self-reported work.

> This is Daniel Okafor, a sample contributor.
>
> His public profile keeps verified work apart from what he reports himself.
>
> Each verified item names the organisation that confirmed it, and links to a record anyone can check.

## Adding a contribution

### Scene 3: claim

**On screen:** Daniel signs in and fills in a new contribution with an evidence link.

> Daniel adds new work: what he did, his role, and a link to the evidence.
>
> It starts as a private draft. Nobody else can see it until he sends it.

## Sending it for review

### Scene 4: send

**On screen:** Daniel sends the claim to Northstar Protocol's Open Grants Portal project.

> He sends it to Northstar Protocol, a fictional organisation, to confirm.
>
> Only Northstar's reviewers will see it.

## The reviewer

### Scene 5: queue

**On screen:** Priya Raman, a reviewer, opens Northstar's review queue and the claim.

> Priya reviews for Northstar. The claim is waiting in her queue, with the evidence Daniel attached.
>
> Nobody can approve their own claim, and the server checks her role on every decision.

## Approval

### Scene 6: approve

**On screen:** Priya approves the claim with a short message.

> She approves it. The claim is frozen into an attestation: a canonical record and its SHA-256 digest.

## Issuing on NEAR

### Scene 7: mint **[NEAR]**

**On screen:** Northstar issues the attestation on NEAR testnet from its own wallet.

> Northstar then issues it on NEAR testnet as a non-transferable NFT.
>
> Atesta never holds a key. The organisation signs in its own wallet.

## Public verification

### Scene 8: verify

**On screen:** The public verification page for the new attestation.

> Anyone can open the public record.
>
> The page hashes the record again, to show it has not changed since approval.
>
> **[NEAR]** It also reads the token live from the NEAR contract, with a link to the transaction.

## Close

### Scene 9: close

**On screen:** Daniel's profile with the new verified contribution.

> Portable, accountable proof of contribution.
>
> Confirmed by the people who saw the work, and checkable by anyone.

---

About 245 words in the full version, roughly 94 seconds of speech at
the voice's pace, plus the time each action takes on screen.
