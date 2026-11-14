# Recording notes

How the two submission videos were made, and what they do and do not show.

**Current status (14 November 2026):** both MP4s below are pre-mint recordings with ProofMe
branding. The contract has since been deployed and a credential minted. Re-record with the current
Atesta branding and `WITH_NEAR=1` before attaching either video to the hackathon post.

## Files

| File                            | What it is                                             |
| ------------------------------- | ------------------------------------------------------ |
| `proofme-demo.mp4`              | Video A, the product demo (local only, not in git)     |
| `proofme-demo.vtt`              | Its captions                                           |
| `proofme-demo-script.md`        | Its narration and scene plan                           |
| `proofme-walkthrough.mp4`       | Video B, the full walkthrough (local only, not in git) |
| `proofme-walkthrough.vtt`       | Its captions                                           |
| `proofme-walkthrough-script.md` | Its narration and scene plan                           |

The MP4 files are kept out of git because of their size; their exact paths are in BUILD_STATUS.md.

## How they were made

- **Source:** the real application, a production build (`next build`, `next start`) on this
  computer, recorded by Playwright driving Chromium. Nothing is mocked or composited: every screen
  is the running app reacting to real clicks and typing.
- **Data:** a fresh local database with only the fictional demo data from `npm run db:seed`
  (Daniel Okafor, Sam Adeyemi, Priya Raman, Northstar Protocol, the Open Grants Portal). Evidence
  links point at example.org, a domain reserved for examples. No real person, organisation or
  partner appears.
- **Resolution:** the browser window is 1536 × 864 (so text is larger than in a 1920-pixel
  layout) and is scaled to 1920 × 1080 when encoding, 30 frames per second, light theme. The
  pointer is drawn by the recorder, because a headless browser has none.
- **Voice:** synthetic. The offline Windows text-to-speech voice "Microsoft Zira Desktop" reads
  the scripts. No person narrated, and nothing was sent to an online voice service.
- **Editing:** the recorder marks where each scene starts and ends. Time between scenes (signing
  in as another account, page loads) is cut out; nothing within a scene is sped up or edited.
- **Encoding:** H.264 video and AAC audio in MP4 (FFmpeg 9.0.2), captions in WebVTT, with one
  cue per spoken sentence timed from the measured length of each sentence.
- **Repeatable:** `npm run video:narrate -- demo`, `npm run video:record -- -g demo` and
  `npm run video:assemble -- demo` rebuild Video A from scratch (and the same for
  `walkthrough`). The narration, captions, scripts and recorder all read
  `tests/recording/narration.ts`, so they cannot drift apart.

## Limitations

- **No NEAR testnet transaction is shown yet.** The attestation contract has not been deployed
  to testnet at the time of recording, so no token could be minted. The videos show the
  organisation's approval, the frozen record and its digest, and the public verification page,
  which says plainly that the record is "not on NEAR yet". The scenes and sentences that need a
  real mint are written (marked **[NEAR]** in the scripts) and are added by re-recording with
  `WITH_NEAR=1` once a real testnet mint exists. No transaction hash was invented.
- The wallet is never shown signing, for the same reason.
- The voice is synthetic and sounds like it.

## Review checklist

Checked on each final file: it plays from start to end; its length is within the target; audio
does not clip; there are no long silences; text on screen is readable at 1080p; the pointer does
not cover what is being shown; no private data (real emails, tokens, file paths) is visible; and
every claim in the narration matches what the app does.
