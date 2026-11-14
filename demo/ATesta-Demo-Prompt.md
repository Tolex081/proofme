# Claude / ChatGPT Prompt: Produce Atesta’s Hackathon Demo

You are helping produce a judge-ready demo video for **Atesta**, a project submitted to **NEAR HACKATHON**. You do not have the team’s chat history, so use this brief and inspect the project files before making decisions.

## First: inspect and verify

1. Read the current `HACKATHON.md` in the repository, if present. If it is missing, read the official current instructions at <https://nearhackathon.com/HACKATHON.md>. Also read:
   - `README.md`
   - `submission/demo-video-guide.md`
   - `submission/recording-notes.md`
   - `demo/README.md`
   - `demo/script.txt`
   - the existing demo scripts and Playwright walkthrough
2. Check the actual app, public verification page, contract details, and any existing videos before describing them. Treat repository files and live behavior as the source of truth; this prompt is context, not permission to invent features.
3. Keep all demo-production files under `/demo/`. Do not modify application logic or unrelated project files.
4. Work in small stages. After each deliverable, confirm that it exists and works before moving to the next. If a required input or service is unavailable, stop and explain exactly what is missing and how I can provide it. Never fake a recording, verification result, voice, soundtrack, or transaction.

## What Atesta does

Atesta is a NEAR-based contribution credential product. A contributor documents a specific piece of work, an organisation reviews the evidence, and an authorised issuer can publish a non-transferable credential NFT on NEAR. A public verification page lets anyone inspect the credential record and compare its SHA-256 digest with the digest held by the NEAR contract.

The main intended users are:

- **Open-source contributors**, including volunteers, students, freelancers, and developers completing funded issues, who want portable proof of a specific contribution.
- **Open-source project maintainers, foundations, and grant or bounty programme teams** that review GitHub-based work and want to endorse accepted contributions.
- **Grant reviewers and hiring teams** who want to inspect what an identified issuer endorsed.
- **Builders of developer portfolios or grant portals** that may want to link to a public credential. Do not imply those products are already integrated.

The current Evidence Agent checks public GitHub evidence. Do not suggest Atesta verifies accounting work, gym memberships, general qualifications, or work with no relevant GitHub evidence. Do not imply an AI approves a contribution; the organisation’s human reviewer makes that decision.

## Verified public demo facts

Use the existing public sample record and verify it is still live before recording:

- App: <https://atesta-near.vercel.app>
- Public sample verification page: <https://atesta-near.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca>
- Testnet contract: `proofme-attest-1113.testnet`
- Sample project: VitaRecall
- Sample claimant: Daniel Okafor
- Sample role: Sole Developer
- Sample issuer: Northstar Protocol
- Sample digest: `e4683f7668f1d159a32344fa720a7fda3a3de1f97adc8126d3fe3ef0fc61d7c3`
- Sample token ID: `11cd86ff-7936-4ee1-9927-2e1cf4e027ca`
- Mint transaction: `9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW`
- Transaction page: <https://testnet.nearblocks.io/txns/9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW>

**Disclosure is essential:** VitaRecall, Daniel Okafor, and Northstar Protocol are fictional sample data. The NEAR testnet token and its mint transaction are real. This is not a real endorsement by Northstar Protocol, and the walkthrough does not mint a new token. Say this plainly in the video or show it clearly on screen.

The contract account still contains the former name “proofme” because the deployed NEAR account cannot be renamed in place. The product, website, and submission are named **Atesta**. If the contract appears on screen or is discussed, explain this continuity accurately; do not hide it or imply it was deployed under the new name.

## Video goal and style

Create a polished, concise demo that helps judges understand the user problem, see the product work, and verify why NEAR matters. It should feel real and specific, with clear app footage, intentional pacing, readable text, and no long setup or architecture lecture.

The user prefers:

- A brief, punchy opening followed by the full live demo.
- A bold, precise **male voice** with a deep tone.
- Quiet background music underneath narration. It should support the pacing without competing with the voice.
- Captions readable on a phone.
- A lively, atmospheric presentation with real product footage, not generic AI graphics.
- Keep the project’s existing font choices where practical.

Use only assets already in the project or properly licensed assets. Record and include required photo, music, and other asset credits in the demo documentation. If using Mixkit’s “Close Up” by Michael Ramir C., check the current license and preserve its restrictions and attribution/source details.

## Required story beats

Use this six-beat structure, keeping the finished primary video at **2 minutes or less**:

1. **Problem (0:00–0:15):** No app yet. State the pain in plain language for open-source contributors and hackathon teams. Example idea: reviewers need checkable proof of what a contributor shipped.
2. **Specificity reveal (0:15–0:30):** Name Atesta and show concrete details from the sample credential. Clearly mark the sample people and issuer as fictional.
3. **Live walkthrough (0:30–1:00):** Record the actual public verification page. Use a scripted cursor and deliberate pauses. Show the credential’s claim, role, dates, issuer, evidence, and verification details where visible.
4. **Numbered steps (1:00–1:30):** Clearly show the verification process: open/fetch the public record, recompute or check its digest, compare it with NEAR. Use only steps supported by the actual app/code.
5. **Proof of result (1:30–1:50):** Show the actual passing checks, active/non-transferable status if visible, and the public testnet mint transaction. Explain specifically that NEAR holds the matching digest, allowing independent public verification.
6. **Close (1:50–2:00):** End with Atesta, a concise tagline, the live app URL, and a visible testnet/sample disclosure.

If producing a separate short teaser as well, make it a real 10–15 second cut from the same verified footage and export both the teaser and the full or combined version. Do not let the combined video exceed two minutes.

## Production requirements

Build in order and keep the work under `/demo/`:

1. **Seed/reference data:** Create or update `/demo/seed.ts` only as a local editorial fixture based on real app data. It must not seed production, write to a live database, or mint a token.
2. **Walkthrough recording:** Use Playwright if available to record the real public verification page with visible cursor movement and pauses. Save raw footage under `/demo/raw/`. Wait for network and verification results explicitly. If a live check fails, stop; do not replace it with a screenshot or fabricated “success.”
3. **Script:** Write `/demo/script.txt`, one narration line per beat, with `[MM:SS]` timestamps. Use plain English and concise lines. Keep narration aligned with what is on screen.
4. **Voiceover:** Generate a natural male voiceover with the available configured TTS. A deep, confident, measured voice is preferred. If no TTS key or suitable local voice exists, stop and give me exact manual steps, voice settings, and save path; do not fake or silently skip the voiceover.
5. **Music:** Use a licensed, restrained background track at low volume, ducked beneath speech. Preserve the track source and license details in `/demo/README.md`.
6. **Captions:** Generate captions timed to the actual narration and burn them into the final video. Also provide a caption sidecar such as VTT or SRT.
7. **Assembly:** Use FFmpeg or the existing project pipeline. Save the final judge-ready export as `/demo/final_demo.mp4`. Print the assembly command and record any dependencies or manual steps in `/demo/README.md`.
8. **Playback check:** Watch or inspect the entire export. Confirm the six beats are present, the narration and captions are synchronized, the disclosure is legible, the music stays behind the voice, both verification checks shown are genuinely passing, the live URL is readable, and the duration is at most two minutes. If any check fails, fix it and review again.

## Accuracy and security

- Do not expose personal email, passwords, wallet recovery phrases, API keys, environment variables, browser profiles, or private inboxes in the recording.
- Do not create or imply a new credential or mint during this demo.
- Do not claim customers, partnerships, endorsements, integrations, or outcomes that are not documented and verified.
- Do not describe the sample issuer or sample people as real.
- Do not claim “powered by NEAR” without explaining what NEAR actually does here: it stores the credential’s digest and token status on the testnet contract, so a viewer can compare the public record with the on-chain value.
- Do not post to X, submit the project, push code, deploy, or sign transactions on my behalf.

## X post and submission handoff

The hackathon instructions require the human to publish the public X demo post. Prepare a draft only. It must:

- Say the project was built at **NEAR HACKATHON**.
- Include `@NEARProtocol` and `#NEARHackathon`.
- Attach the video.
- Lead with the user problem, explain NEAR’s role concretely, link the app and public repository, and invite a specific response or question.

The repository is <https://github.com/Tolex081/atesta>. Verify the live URL and repository still work before putting them in a draft.

The human publishes the post, then provides its public URL for the hackathon submission. Do not submit a second time if Atesta has already been submitted. If the saved submission needs correction, follow the official request-changes process. Never submit an application without showing the exact payload and receiving explicit confirmation.

## Done means

- `/demo/final_demo.mp4` exists, plays correctly, and is at most 2 minutes.
- The six story beats are clear, with actual app footage and truthful, passing results.
- Male narration, quiet music, and synchronized captions are included.
- Fictional sample data and the real testnet record are distinguished clearly.
- The demo README documents how to reproduce the video, dependencies, and media credits.
- A draft X post and the exact next step for the human are provided.
