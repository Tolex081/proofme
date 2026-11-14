# Recording notes

How the current Atesta submission demo was made, and what it does and does not show.

**Current status (14 November 2026):** the recommended submission video is `demo/final_demo.mp4`,
a 73-second six-beat cut with a male voiceover, quiet music, and captions. It identifies the target
users, shows the actual public verification page, and discloses that the sample claimant, project,
and issuer are fictional while the NEAR testnet token and mint transaction are real. Review this
file before attaching it to the hackathon post. Earlier teaser/full-demo exports listed below are
alternatives and are not the current recommended attachment. The older ProofMe-branded recordings
are obsolete and must not be submitted.

## Files

| File                            | What it is                                                    |
| ------------------------------- | ------------------------------------------------------------- |
| `../demo/final_demo.mp4`        | Recommended 73-second six-beat export                         |
| `../demo/captions.vtt`          | Captions for the recommended export                           |
| `atesta-demo-with-intro.mp4`    | Earlier 89.7-second teaser plus full demo (local only)        |
| `atesta-demo-with-intro.vtt`    | Captions for the earlier combined video                       |
| `atesta-teaser.mp4`             | Earlier short 15-second opening (local only)                  |
| `atesta-teaser.vtt`             | Captions for the earlier short opening                        |
| `atesta-demo.mp4`               | Earlier 74.7-second full demo (local only, not in git)        |
| `atesta-demo.vtt`               | Captions for the earlier full demo                            |
| `atesta-demo-script.md`         | Its narration and scene plan                                  |
| `proofme-demo.mp4`              | Obsolete ProofMe-branded, pre-mint recording (local only)     |
| `proofme-demo.vtt`              | Captions for the obsolete recording                           |
| `proofme-demo-script.md`        | Script for the obsolete recording                             |
| `proofme-walkthrough.mp4`       | Obsolete ProofMe-branded walkthrough (local only, not in git) |
| `proofme-walkthrough.vtt`       | Captions for the obsolete walkthrough                         |
| `proofme-walkthrough-script.md` | Script for the obsolete walkthrough                           |

The older `/submission/*.mp4` exports are ignored by Git. The current
`demo/final_demo.mp4` is not ignored and is the video intended to be included with the demo source
when publishing the repository. Check the final Git status before pushing so the current video and
caption file are included.

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
