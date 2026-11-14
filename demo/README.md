# Atesta demo pipeline

The judge cut is `demo/final_demo.mp4` (about 73 seconds). It follows six beats: problem, a specific sample credential, the live public walkthrough, numbered verification steps, the passing result, and a closing URL with the testnet disclosure.

## Build in order

1. `demo/seed.ts` documents the local editorial fixture. It mirrors the already minted public testnet record; it does not seed a production database or create a token.
2. Record the current public verification page: `npx playwright test --config=demo/playwright.config.ts`. This saves `demo/raw/atesta-walkthrough.webm` and captures the passing checks used by the edit.
3. `demo/script.txt` contains the six narration beats and their start times.
4. Download the selected music cue with `powershell -ExecutionPolicy Bypass -File demo/get-music.ps1`.
5. Generate narration and time-matched caption files with `powershell -ExecutionPolicy Bypass -File demo/generate-voiceover.ps1`. It uses the installed local voice `Microsoft David Desktop`; it does not send audio to a remote service. The script stops if no male local voice is available.
6. Render the designed cards with `npx tsx demo/render-cards.mts`, then assemble on Windows with `powershell -ExecutionPolicy Bypass -File demo/assemble.ps1`. `demo/assemble.sh` is the equivalent FFmpeg entry point for Bash environments with `ffmpeg` on `PATH`.

## What the sample means

The screen shows a **VitaRecall** hackathon-achievement record, with the role **Sole Developer** and named issuer **Northstar Protocol**. The sample names and project are fictional; the testnet token and mint transaction are real. The cut shows public verification of that existing token. It does not show a new mint or the full contribution-review flow. It must not be presented as a real endorsement by Northstar Protocol.

The video shows the actual public record, digest check, live NEAR contract result, active/non-transferable status, and linked mint transaction. No screen or result is mocked.

## Music and photo credits

- Music: “Close Up” by Michael Ramir C., from [Mixkit's rhythmic underscore collection](https://mixkit.co/free-stock-music/rhythmic-underscore/). The [Mixkit Free License](https://mixkit.co/license/modal/musicFree/) permits use in online and social videos. It excludes TV/radio broadcast, video games, and CDs/DVDs, and does not permit distributing the music as a standalone track. The soundtrack is mixed under the voice and embedded in the MP4.
- The opening and closing photographs are already part of Atesta's site assets; their original Unsplash credits are listed in the project README.

## Manual fallback

If the live site or NEAR testnet check is unavailable, stop the recording and retry when it returns. Do not replace a failed check with an image or a fabricated result. If the local David voice is unavailable, install a male Windows text-to-speech voice and rerun the voiceover script; do not use a different voice without reviewing the sound.
