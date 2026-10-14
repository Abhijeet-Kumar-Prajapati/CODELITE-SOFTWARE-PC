@echo off
title CodeLite - Stop

rem Stops the CodeLite local server and closes any CodeLite app window.

echo Stopping CodeLite...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p=0; $pf=Join-Path $env:TEMP 'codelite.port'; if (Test-Path $pf) { $p=(Get-Content $pf -Raw).Trim() }; if ($p -match '^[0-9]+$') { try { Invoke-WebRequest -UseBasicParsing -Method Post -Uri ('http://localhost:'+$p+'/shutdown') -TimeoutSec 2 | Out-Null } catch {} }; $me=$PID; Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -like '*CodeLiteServer*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

taskkill /IM msedge.exe /FI "WINDOWTITLE eq CodeLite*" /T /F >nul 2>&1

del /q "%TEMP%\codelite.port" >nul 2>&1

echo CodeLite stopped.
timeout /t 2 >nul
exit /b 0