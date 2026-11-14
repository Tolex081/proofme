$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$DemoDir = $PSScriptRoot
$VoiceDir = Join-Path $DemoDir "voiceover"
$SegmentDir = Join-Path $VoiceDir "segments"
$ScriptPath = Join-Path $DemoDir "script.txt"
New-Item -ItemType Directory -Force -Path $SegmentDir | Out-Null

$FfmpegPath = $env:FFMPEG
$FfprobePath = $env:FFPROBE
if (-not $FfmpegPath -or -not (Test-Path -LiteralPath $FfmpegPath)) {
  $FfmpegPath = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
}
if (-not $FfprobePath -or -not (Test-Path -LiteralPath $FfprobePath)) {
  $FfprobePath = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe"
}
if (-not (Test-Path -LiteralPath $FfmpegPath) -or -not (Test-Path -LiteralPath $FfprobePath)) {
  throw "FFmpeg and FFprobe are required. Install FFmpeg or set FFMPEG and FFPROBE to their executable paths."
}

Add-Type -AssemblyName System.Speech
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$voiceName = "Microsoft David Desktop"
$available = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($available -notcontains $voiceName) {
  $available = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Gender -eq "Male" }
  if (-not $available) {
    $synth.Dispose()
    throw "No male local TTS voice is installed. Install a male Windows speech voice, then rerun this script."
  }
  $voiceName = $available[0].VoiceInfo.Name
}

$synth.SelectVoice($voiceName)
$synth.Rate = -2
$synth.Volume = 100

function Format-VttTime([double]$Seconds) {
  $ms = [int][Math]::Round($Seconds * 1000)
  $hours = [Math]::Floor($ms / 3600000)
  $minutes = [Math]::Floor(($ms % 3600000) / 60000)
  $seconds = [Math]::Floor(($ms % 60000) / 1000)
  $millis = $ms % 1000
  return "{0:00}:{1:00}:{2:00}.{3:000}" -f $hours, $minutes, $seconds, $millis
}

function Format-SrtTime([double]$Seconds) {
  return (Format-VttTime $Seconds).Replace('.', ',')
}

$lines = Get-Content -LiteralPath $ScriptPath | Where-Object { $_ -match '^\[(\d{2}):(\d{2})\]\s+(.+)$' }
if ($lines.Count -ne 6) { throw "Expected six timed narration lines in demo/script.txt; found $($lines.Count)." }

$segments = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  $match = [regex]::Match($lines[$i], '^\[(\d{2}):(\d{2})\]\s+(.+)$')
  $start = ([int]$match.Groups[1].Value * 60) + [int]$match.Groups[2].Value
  $text = $match.Groups[3].Value
  $wav = Join-Path $SegmentDir ("beat-{0}.wav" -f ($i + 1))
  $synth.SetOutputToWaveFile($wav)
  $synth.Speak($text)
  $synth.SetOutputToNull()
  $durationText = & $FfprobePath -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $wav
  if ($LASTEXITCODE -ne 0) { throw "FFprobe could not read $wav." }
  $duration = [double]::Parse($durationText.Trim(), [Globalization.CultureInfo]::InvariantCulture)
  $segments += [pscustomobject]@{ Start = [double]$start; Duration = $duration; Text = $text; Path = $wav }
}
$synth.Dispose()

for ($i = 0; $i -lt $segments.Count - 1; $i++) {
  if (($segments[$i].Start + $segments[$i].Duration + 0.35) -gt $segments[$i + 1].Start) {
    throw "Narration beat $($i + 1) runs into the next beat. Shorten the line or move its timestamp in demo/script.txt."
  }
}

$inputs = @("-hide_banner", "-y")
$filters = @()
$labels = @()
for ($i = 0; $i -lt $segments.Count; $i++) {
  $inputs += @("-i", $segments[$i].Path)
  $delay = [int][Math]::Round($segments[$i].Start * 1000)
  $filters += "[$($i):a]aresample=48000,adelay=$delay|$delay[v$i]"
  $labels += "[v$i]"
}
$filterGraph = ($filters -join ";") + ";" + ($labels -join "") + "amix=inputs=$($segments.Count):duration=longest:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]"
$voicePath = Join-Path $VoiceDir "voiceover.mp3"
$inputs += @("-filter_complex", $filterGraph, "-map", "[out]", "-codec:a", "libmp3lame", "-q:a", "3", $voicePath)
& $FfmpegPath @inputs
if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed to build the voiceover." }

$vtt = @("WEBVTT", "")
$srt = @()
for ($i = 0; $i -lt $segments.Count; $i++) {
  $segment = $segments[$i]
  $start = $segment.Start + 0.15
  $end = [Math]::Min($start + $segment.Duration, $segments[-1].Start + $segments[-1].Duration)
  $vtt += @("$((Format-VttTime $start)) --> $((Format-VttTime $end))", $segment.Text, "")
  $srt += @([string]($i + 1), "$((Format-SrtTime $start)) --> $((Format-SrtTime $end))", $segment.Text, "")
}
Set-Content -LiteralPath (Join-Path $DemoDir "captions.vtt") -Value $vtt -Encoding utf8NoBOM
Set-Content -LiteralPath (Join-Path $DemoDir "captions.srt") -Value $srt -Encoding utf8NoBOM
Set-Content -LiteralPath (Join-Path $VoiceDir "voice-name.txt") -Value $voiceName -Encoding utf8NoBOM
Write-Output "Generated demo/voiceover/voiceover.mp3 and timed captions using $voiceName."
