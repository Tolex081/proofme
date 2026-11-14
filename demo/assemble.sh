#!/usr/bin/env bash
set -euo pipefail

FFMPEG="${FFMPEG:-ffmpeg}"
RAW="demo/raw/atesta-walkthrough.webm"
VOICE="demo/voiceover/voiceover.mp3"
MUSIC="demo/build/close-up-1167.mp3"
OUT="demo/final_demo.mp4"

for file in "$RAW" "$VOICE" "$MUSIC" \
  demo/assets/problem.png demo/assets/specificity.png \
  demo/assets/steps.png demo/assets/closing.png demo/captions.srt; do
  test -f "$file" || { echo "Missing $file" >&2; exit 1; }
done

# Beat map: 0–8 problem, 8–18 specificity, 18–43 live walkthrough,
# 43–56 numbered checks, 56–65 proof, 65–73 close. The app footage and
# verification values come from the public Atesta sample credential.
FILTER="\
[0:v]zoompan=z='min(zoom+0.00015,1.035)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=8,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.35,fade=t=out:st=7.65:d=0.35[intro];\
[1:v]zoompan=z='min(zoom+0.00012,1.035)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=10,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.35,fade=t=out:st=9.65:d=0.35[specificity];\
[2:v]trim=start=9:duration=25,setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,fps=30,format=yuv420p[walk];\
[3:v]zoompan=z='min(zoom+0.00005,1.02)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=13,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.3,fade=t=out:st=12.7:d=0.3[steps];\
[2:v]trim=start=45:duration=9,setpts=PTS-STARTPTS,scale=1920:1080:flags=lanczos,fps=30,format=yuv420p[proof];\
[4:v]zoompan=z='min(zoom+0.00012,1.035)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,trim=duration=8,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.35,fade=t=out:st=7.65:d=0.35[close];\
[intro][specificity][walk][steps][proof][close]concat=n=6:v=1:a=0,subtitles=demo/captions.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,BackColour=&H40101118,BorderStyle=3,Outline=1,OutlineColour=&H00000000,Shadow=0,MarginV=48,Alignment=2'[v];\
[5:a]aresample=48000,apad,atrim=duration=73,asetpts=PTS-STARTPTS,asplit=2[voicekey][voice];\
[6:a]aresample=48000,atrim=duration=73,asetpts=PTS-STARTPTS,volume=0.26,afade=t=in:d=0.7,afade=t=out:st=71.5:d=1.4[music];\
[music][voicekey]sidechaincompress=threshold=0.025:ratio=3:attack=25:release=600[ducked];\
[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0,aformat=channel_layouts=stereo,alimiter=limit=0.95[a]"

echo "FFmpeg command: $FFMPEG [card inputs] -i $RAW -i $VOICE -i $MUSIC -filter_complex <six-beat edit, burned captions, ducked music> -map [v] -map [a] -t 73 -c:v libx264 -crf 19 -c:a aac -b:a 192k $OUT"

"$FFMPEG" -hide_banner -y \
  -loop 1 -framerate 30 -t 8 -i demo/assets/problem.png \
  -loop 1 -framerate 30 -t 10 -i demo/assets/specificity.png \
  -i "$RAW" \
  -loop 1 -framerate 30 -t 13 -i demo/assets/steps.png \
  -loop 1 -framerate 30 -t 8 -i demo/assets/closing.png \
  -i "$VOICE" -i "$MUSIC" \
  -filter_complex "$FILTER" -map '[v]' -map '[a]' -t 73 \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart "$OUT"

echo "Created $OUT (73 seconds)."
