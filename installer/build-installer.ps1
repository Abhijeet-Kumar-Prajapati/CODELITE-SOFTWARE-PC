# =====================================================================
#  build-installer.ps1
#  Compiles CodeLite-Setup-<version>.exe using Inno Setup 6.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File build-installer.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$iss  = Join-Path $PSScriptRoot 'CodeLite.iss'

# ---- locate the Inno Setup compiler ----
$candidates = @(
    "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LocalAppData\Programs\Inno Setup 6\ISCC.exe"
)
$iscc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
    Write-Host ''
    Write-Host 'Inno Setup 6 was not found.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Install it with winget:' -ForegroundColor Yellow
    Write-Host '    winget install --id JRSoftware.InnoSetup -e'
    Write-Host ''
    Write-Host 'or download it from https://jrsoftware.org/isdl.php' -ForegroundColor Yellow
    Write-Host ''
    exit 1
}

Write-Host "Using compiler : $iscc" -ForegroundColor Cyan
Write-Host "Script         : $iss" -ForegroundColor Cyan
Write-Host ''

Push-Location $PSScriptRoot
try {
    & $iscc $iss
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host 'Compilation FAILED.' -ForegroundColor Red
        exit $LASTEXITCODE
    }
}
finally { Pop-Location }

$dist = Join-Path $root 'dist'
$exe  = Get-ChildItem $dist -Filter 'CodeLite-Setup-*.exe' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($exe) {
    Write-Host ''
    Write-Host ("Built  : {0}" -f $exe.FullName) -ForegroundColor Green
    Write-Host ("Size   : {0:N2} MB" -f ($exe.Length / 1MB)) -ForegroundColor Green
    Write-Host ''
    Write-Host 'Test it with a silent install:' -ForegroundColor DarkGray
    Write-Host ('    "{0}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -f $exe.Name) -ForegroundColor DarkGray
}