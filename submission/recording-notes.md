# Recording notes

How the current Atesta submission demo was made, and what it does and does not show.

**Current status (14 November 2026):** `atesta-demo.mp4` is the current 74.7-second recording
candidate. It uses the live Atesta verification page and shows the real NEAR testnet token and mint
link. The sample claimant and issuer are fictional, so the video calls this a demo record rather
than a genuine third-party endorsement. Review the file before attaching it to the hackathon post.
The older ProofMe recordings listed below are obsolete and must not be submitted.

## Files

| File                               | What it is                                                     |
| ---------------------------------- | -------------------------------------------------------------- |
| `atesta-demo.mp4`                  | Current product demo (local only, not in git)                  |
| `atesta-demo.vtt`                  | Its WebVTT captions                                            |
| `atesta-demo-script.md`            | Its narration and scene plan                                   |
| `proofme-demo.mp4`                 | Obsolete ProofMe-branded, pre-mint recording (local only)      |
| `proofme-demo.vtt`                 | Captions for the obsolete recording                           |
| `proofme-demo-script.md`           | Script for the obsolete recording                             |
| `proofme-walkthrough.mp4`          | Obsolete ProofMe-branded walkthrough (local only, not in git)  |
| `proofme-walkthrough.vtt`          | Captions for the obsolete walkthrough                         |
| `proofme-walkthrough-script.md`    | Script for the obsolete walkthrough                           |

MP4 files are kept out of git because of their size. The current demo lives at
`submission/atesta-demo.mp4` on the creator's machine.

## How they were made

- **Source:** the live public Atesta verification page, recorded by Playwright driving Chromium.
  The verification page and its on-chain checks are genuine. Nothing is mocked or composited.
- **Data:** the sample claimant and issuer are fictional. The credential and testnet mint exist on
  chain, but the sample record is not a genuine third-party endorsement. Do not describe it as one.
- **Resolution:** the browser window is 1536 × 864 (so text is larger than in a 1920-pixel
  layout) and is scaled to 1920 × 1080 when encoding, 30 frames per second, light theme. The
  pointer is drawn by the recorder, because a headless browser has none.
- **Voice:** synthetic male delivery. The offline Windows text-to-speech voice "Microsoft David
  Desktop" reads the script at a slightly slower rate for a measured, precise sound. Nothing was
  sent to an online voice service.
- **Editing:** the recorder marks where each scene starts and ends. Time between scenes (signing
  in as another account, page loads) is cut out; nothing within a scene is sped up or edited.
- **Encoding:** H.264 video and AAC audio in MP4 (FFmpeg 9.0.2), captions in WebVTT, with one
  cue per spoken sentence timed from the measured length of each sentence.
- **Repeatable:** `npm run video:narrate -- demo`,
  `npx playwright test --config playwright.public-recording.config.ts --grep "record the public credential verification demo"`,
  and `npm run video:assemble -- demo` rebuild the current demo. The narration, captions, script
  and recorder all read
  `tests/recording/narration.ts`, so they cannot drift apart.

## Limitations

- This short demo focuses on public credential verification. It does not show the full contribution
  review lifecycle, a wallet signing, or a new mint. The visible mint link points to the real
  testnet transaction for the sample token.
- The voice is synthetic and may sound synthetic.

## Review checklist

Checked on each final file: it plays from start to end; its length is within the target; audio
does not clip; there are no long silences; text on screen is readable at 1080p; the pointer does
not cover what is being shown; no private data (real emails, tokens, file paths) is visible; and
every claim in the narration matches what the app does.
