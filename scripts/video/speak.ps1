# Speaks each line of a JSON list into its own WAV file with the offline
# Windows voice. Input: [{ "file": "path.wav", "text": "..." }, ...]
# Used by `npm run video:narrate`. Nothing leaves the machine.
param(
  [Parameter(Mandatory = $true)][string]$Manifest,
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = 0
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 $Manifest | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($item in $items) {
  $synth.SetOutputToWaveFile($item.file, $format)
  $synth.Speak($item.text)
}
$synth.SetOutputToNull()
$synth.Dispose()
Write-Output "Spoke $($items.Count) lines with $Voice."
