$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$DemoDir = $PSScriptRoot
$BuildDir = Join-Path $DemoDir "build"
$MusicFile = Join-Path $BuildDir "close-up-1167.mp3"
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

if (-not (Test-Path -LiteralPath $MusicFile)) {
  Invoke-WebRequest -Uri "https://assets.mixkit.co/music/1167/1167.mp3" -OutFile $MusicFile
}

$item = Get-Item -LiteralPath $MusicFile
if ($item.Length -lt 1000000) { throw "The Mixkit download looks incomplete. Remove the file and rerun this script." }
Write-Output "Music is ready at demo/build/close-up-1167.mp3 ($($item.Length) bytes). Keep it embedded in the video; do not redistribute as a standalone track."
