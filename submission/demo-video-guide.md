# Atesta demo video guide

This guide turns the NEAR HACKATHON demo-post instructions into a short, recordable walkthrough.
The post must be published by the project owner; this file is a preparation guide, not permission
for an agent to post on the owner's behalf.

## What the hackathon requires

Publish a **public post on X** that:

- says the project was built at **NEAR HACKATHON**;
- tags **@NEARProtocol** and includes **#NEARHackathon**;
- has the demo video or screenshots attached.

The instructions recommend leading with the user problem, showing one complete moment from a real
user action to a visible result, explaining concretely what NEAR enables and why that matters, then
giving viewers a next step. Keep the demo focused: skip a long intro, architecture slides and
setup.

## Audience and point of the demo

Atesta's clearest users are public-GitHub contributors (including volunteers, students, freelancers
and funded bounty contributors), and the maintainers, foundations or grant programmes that review
their work. A developer portfolio or grant portal could also link to an Atesta credential so its
reviewers can check the issuer's endorsement. This short demo focuses on an open-source maintainer
or grant reviewer checking a **sample** credential. The people and issuer in the sample are
fictional. The named examples in the README are possible fits only; they are not Atesta customers
or partners.

The viewer should understand this before the video ends: **open the public sample credential, see
its record digest match the live NEAR testnet contract, and see the public transaction link to the
real mint.** The record's people and issuer are fictional; do not present them as a genuine
endorsement.

## Before recording

1. Open the live Atesta site and test the minted sample credential URL:
   <https://atesta-near.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca>.
2. Confirm the page loads and shows both successful checks: the record hashes to its digest, and
   the NEAR contract holds the same digest. The sample claimant and issuer are fictional; the NFT
   and its mint transaction are real testnet events, not a genuine third-party endorsement.
3. Use the supplied sample credential only. Do not show personal
   email, wallet recovery phrases, API keys, environment variables, browser passwords or private
   inboxes.
4. Close unrelated tabs and notifications. Use a clean browser window, readable zoom and a pointer
   that does not cover the status text. Record the browser at a size where the verification result
   can be read on a phone.
5. Rehearse the exact clicks once. If the live check is unavailable, stop and resolve it before
   recording; do not replace the result with a mock screen or imply an unconfirmed mint.

## Suggested 60–90 second recording

Record one continuous product moment, then trim only dead time at the beginning and end. Keep the
cursor, page movement and visible result aligned with the narration.

| Time | On screen — do this | Say this — or use your own natural wording |
| --- | --- | --- |
| 0–15 sec | Start directly on Atesta's public credential page. Show the claim and issuer. | “Open-source contributors and grant-funded developers need to show which team accepted their code. Atesta gives project maintainers and grant programmes a way to issue a credential for a specific GitHub contribution. This demo uses fictional people and an organisation, but its public NEAR testnet token is real.” |
| 15–30 sec | Scroll to **How this was checked** and point to the record digest result. | “The first check confirms the public record matches its digest.” |
| 30–45 sec | Point to the NEAR contract check and pause so the passing result is readable. | “The second reads the live NEAR testnet contract. It holds the same digest.” |
| 45–60 sec | Show the active, non-transferable status, issuer, holder and transaction link. | “The credential is active and non-transferable. The page names the issuer and holder and links to the real mint transaction. NEAR anchors this record publicly, so anyone can check it later.” |
| 60–80 sec | Return to the passing checks and hold the view for a moment. | “This can help open-source maintainers, grant reviewers and developer portfolio builders check a specific endorsement. In real use, the authorised organisation makes the decision. This sample shows how anyone can check the record. Try the live demo and inspect the repository.” |

The timings are a guide. Keep only statements that the current screen supports. Do not claim that
the browser recording itself is a new mint: the linked token was already minted on testnet.

## Finish and publish

1. Watch the entire export once. Confirm the claim, issuer, matching hash results, active token and
   transaction are legible and agree with the narration.
2. Attach the exported video to a **public** X post. Screenshots are also permitted by the
   instructions, but a short video is preferred because it shows the check happening.
3. Include the required event wording, tags, links and a genuine question or specific invitation.
   Suggested post:

   > Open-source maintainers and grant programmes need a reliable way to confirm what contributors
   > actually shipped. I built Atesta at NEAR HACKATHON so they can endorse a specific GitHub
   > contribution with a credential anyone can check on NEAR. Watch the live check:
   > https://atesta-near.vercel.app
   > Repo: https://github.com/Tolex081/atesta
   > What would you want to see in a verifiable work credential? @NEARProtocol #NEARHackathon

4. Publish the post yourself, then copy its public URL. That post URL—not just the app URL—is the
   demo link required in the submission.

## After publishing

- Keep the video and post public and accessible to judges.
- Send the public X post URL to the submission checklist.
- Do not submit Atesta a second time if it has already been submitted. If a saved submission needs
  a correction, use the hackathon's request-changes process.

The source requirements are in the live [NEAR HACKATHON instructions](https://nearhackathon.com/HACKATHON.md),
especially the demo-post instructions and Q-012.
