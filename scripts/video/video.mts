/**
 * Builds the submission videos in three steps:
 *
 *   npm run video:narrate -- demo     speak the narration, measure each sentence
 *   npm run video:record -- demo      record the real app (Playwright)
 *   npm run video:assemble -- demo    cut, add the voice, encode MP4, write captions
 *
 * `npm run video:scripts` writes the narration scripts into submission/.
 * Set WITH_NEAR=1 once a real NEAR testnet mint is part of the recording.
 *
 * The voice is the offline Windows text-to-speech voice (synthetic, and
 * disclosed as such in submission/recording-notes.md).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { scenesFor, spoken, VIDEOS, type VideoName } from "../../tests/recording/narration";

const BUILD = "submission/build";
const WITH_NEAR = process.env.WITH_NEAR === "1";
const LEAD = 0.5;
const GAP = 0.35;
const OUTPUT_NAMES: Record<VideoName, string> = {
  demo: "atesta-demo",
  walkthrough: "atesta-walkthrough",
};

function tool(name: "ffmpeg" | "ffprobe"): string {
  const fromEnv = process.env.FFMPEG_DIR;
  if (fromEnv) return join(fromEnv, `${name}.exe`);
  const packages = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages");
  if (existsSync(packages)) {
    for (const dir of readdirSync(packages).filter((d) => d.startsWith("Gyan.FFmpeg"))) {
      for (const build of readdirSync(join(packages, dir))) {
        const candidate = join(packages, dir, build, "bin", `${name}.exe`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return name;
}

function duration(file: string): number {
  const out = execFileSync(tool("ffprobe"), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);
  return Number(out.toString().trim());
}

function videoArg(): VideoName {
  const name = process.argv[3];
  if (name !== "demo" && name !== "walkthrough") {
    console.error("Say which video: demo or walkthrough.");
    process.exit(1);
  }
  return name;
}

// ── Scripts ──────────────────────────────────────────────────────────────────

function writeScripts() {
  mkdirSync("submission", { recursive: true });
  for (const name of ["demo", "walkthrough"] as const) {
    const video = VIDEOS[name];
    const lines = [
      `# ${video.title}: narration and scene plan`,
      "",
      `Target length: ${video.target}. Generated from \`tests/recording/narration.ts\`, which also`,
      "drives the recording, the voice track and the captions, so all four always match.",
      "",
      "The sample claimant and organisation are fictional; the public credential and NEAR testnet",
      "transaction shown are real. The voice is synthetic, generated locally with Windows speech.",
      "",
      "Lines marked **[NEAR]** are recorded only once the contract is on NEAR testnet and a real",
      "token has been minted; until then they are left out of the video and its captions.",
      "",
    ];
    let chapter = "";
    video.scenes.forEach((scene, index) => {
      if (scene.chapter !== chapter) {
        chapter = scene.chapter;
        lines.push(`## ${chapter}`, "");
      }
      lines.push(
        `### Scene ${index + 1}: ${scene.id}${scene.near ? " **[NEAR]**" : ""}`,
        "",
        `**On screen:** ${scene.shows}`,
        "",
      );
      for (const item of scene.narration) {
        if (typeof item === "string") lines.push(`> ${item}`, ">");
        else if (item.near === true) lines.push(`> **[NEAR]** ${item.text}`, ">");
        else if (item.near === false) lines.push(`> **[without NEAR]** ${item.text}`, ">");
        else lines.push(`> ${item.text}`, ">");
      }
      lines.pop();
      lines.push("");
    });
    const words = video.scenes
      .flatMap((scene) => spoken(scene, true))
      .join(" ")
      .split(/\s+/).length;
    lines.push(
      "---",
      "",
      `About ${words} words in the full version, roughly ${Math.round(words / 2.6)} seconds of speech at`,
      "the voice's pace, plus the time each action takes on screen.",
      "",
    );
    writeFileSync(`submission/${OUTPUT_NAMES[name]}-script.md`, lines.join("\n"));
    console.log(`Wrote submission/${OUTPUT_NAMES[name]}-script.md`);
  }
}

// ── Narration ────────────────────────────────────────────────────────────────

function narrate(name: VideoName) {
  const dir = `${BUILD}/${name}/voice`;
  mkdirSync(dir, { recursive: true });
  const items: { file: string; text: string }[] = [];
  const plan: Record<string, string[]> = {};
  for (const scene of scenesFor(name, WITH_NEAR)) {
    plan[scene.id] = [];
    spoken(scene, WITH_NEAR).forEach((text, index) => {
      const file = resolve(dir, `${scene.id}-${index + 1}.wav`);
      items.push({ file, text });
      plan[scene.id].push(file);
    });
  }
  const manifest = resolve(`${BUILD}/${name}/speak.json`);
  writeFileSync(manifest, JSON.stringify(items));
  const out = execFileSync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "scripts/video/speak.ps1",
    "-Manifest",
    manifest,
    "-Voice",
    process.env.ATTESTA_TTS_VOICE ?? "Microsoft David Desktop",
    "-Rate",
    process.env.ATTESTA_TTS_RATE ?? "-1",
  ]);
  console.log(out.toString().trim());
  const durations = Object.fromEntries(
    Object.entries(plan).map(([id, files]) => [id, files.map(duration)]),
  );
  writeFileSync(
    `${BUILD}/${name}/narration.json`,
    JSON.stringify({ withNear: WITH_NEAR, durations, files: plan }, null, 2),
  );
  const total = Object.values(durations)
    .flat()
    .reduce((a, b) => a + b, 0);
  console.log(`Narration for ${name}: ${items.length} sentences, ${total.toFixed(1)}s of speech.`);
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function stamp(seconds: number) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(rest, 3)}`;
}

/** Breaks a caption into at most two lines of about 42 characters. */
function wrap(text: string) {
  if (text.length <= 46) return text;
  const middle = Math.floor(text.length / 2);
  let cut = text.lastIndexOf(" ", middle);
  if (cut < 10) cut = text.indexOf(" ", middle);
  return `${text.slice(0, cut)}\n${text.slice(cut + 1)}`;
}

function findRawVideo(): string {
  const root = `${BUILD}/raw`;
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".webm")) found.push(path);
    }
  };
  if (existsSync(root)) walk(root);
  if (found.length !== 1) {
    throw new Error(`Expected one raw recording in ${root}, found ${found.length}. Record again.`);
  }
  return found[0];
}

function assemble(name: VideoName) {
  const narration = JSON.parse(readFileSync(`${BUILD}/${name}/narration.json`, "utf8"));
  const timeline = JSON.parse(readFileSync(`${BUILD}/${name}/timeline.json`, "utf8"));
  if (narration.withNear !== timeline.withNear) {
    throw new Error("Narration and recording disagree about NEAR. Run both again.");
  }
  const raw = findRawVideo();
  const scenes: { id: string; start: number; end: number }[] = timeline.scenes;

  const inputs: string[] = ["-i", raw];
  const filters: string[] = [];
  const voices: string[] = [];
  const cues: string[] = ["WEBVTT", ""];
  let at = 0;
  let input = 1;
  scenes.forEach((scene, index) => {
    filters.push(
      `[0:v]trim=start=${scene.start.toFixed(3)}:end=${scene.end.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`,
    );
    const files: string[] = narration.files[scene.id];
    const lengths: number[] = narration.durations[scene.id];
    const texts = spoken(
      VIDEOS[name].scenes.find((s) => s.id === scene.id)!,
      timeline.withNear,
    );
    let offset = at + LEAD;
    files.forEach((file, sentence) => {
      inputs.push("-i", file);
      const ms = Math.round(offset * 1000);
      filters.push(`[${input}:a]adelay=${ms}|${ms},aformat=channel_layouts=stereo[a${input}]`);
      voices.push(`[a${input}]`);
      cues.push(
        `${stamp(offset)} --> ${stamp(offset + lengths[sentence])}`,
        wrap(texts[sentence]),
        "",
      );
      offset += lengths[sentence] + GAP;
      input += 1;
    });
    at += scene.end - scene.start;
  });
  filters.push(
    `${scenes.map((_, index) => `[v${index}]`).join("")}concat=n=${scenes.length}:v=1:a=0,fps=30,scale=1920:1080:flags=lanczos,format=yuv420p[v]`,
  );
  filters.push(
    `${voices.join("")}amix=inputs=${voices.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad[a]`,
  );

  const out = `submission/${OUTPUT_NAMES[name]}.mp4`;
  execFileSync(
    tool("ffmpeg"),
    [
      "-y",
      "-loglevel",
      "error",
      ...inputs,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-t",
      at.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: "inherit" },
  );
  writeFileSync(`submission/${OUTPUT_NAMES[name]}.vtt`, cues.join("\n"));
  console.log(
    `Wrote ${out} (${duration(out).toFixed(1)}s) and submission/${OUTPUT_NAMES[name]}.vtt (${voices.length} cues).`,
  );
}

const command = process.argv[2];
if (command === "scripts") writeScripts();
else if (command === "narrate") narrate(videoArg());
else if (command === "assemble") assemble(videoArg());
else {
  console.error("Usage: video.mts scripts | narrate <video> | assemble <video>");
  process.exit(1);
}
