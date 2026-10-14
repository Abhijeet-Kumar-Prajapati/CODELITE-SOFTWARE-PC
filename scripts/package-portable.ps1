# =====================================================================
#  package-portable.ps1
#  Builds the portable ZIP (no installer, just double-click the .bat).
#
#  Usage:  powershell -ExecutionPolicy Bypass -File package-portable.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$src     = Join-Path $root 'src'
$dist    = Join-Path $root 'dist'
$version = '1.0.0'
$stage   = Join-Path $env:TEMP ("codelite-portable-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$zip     = Join-Path $dist ("CodeLite-Portable-{0}.zip" -f $version)

New-Item -ItemType Directory -Force -Path $dist | Out-Null
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }

Write-Host 'Staging portable build...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item "$src\*" -Destination $stage -Recurse -Force

# swap in the guides
Copy-Item (Join-Path $root 'docs\USER-GUIDE-EN.txt') (Join-Path $stage 'User Guide.txt') -Force
Copy-Item (Join-Path $root 'docs\USER-GUIDE-HI.txt') (Join-Path $stage 'User Guide (Hindi).txt') -Force
Remove-Item (Join-Path $stage 'app\*.map') -Force -ErrorAction SilentlyContinue

Write-Host 'Compressing...' -ForegroundColor Cyan
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal

Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue

Write-Host ''
Write-Host ("Built : {0}" -f $zip) -ForegroundColor Green
Write-Host ("Size  : {0:N2} MB" -f ((Get-Item $zip).Length / 1MB)) -ForegroundColor Green
Write-Host ''
Write-Host 'Extract anywhere and double-click START CodeLite.bat' -ForegroundColor DarkGray