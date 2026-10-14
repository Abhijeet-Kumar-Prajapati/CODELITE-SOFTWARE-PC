@echo off
setlocal EnableExtensions EnableDelayedExpansion
title CodeLite Launcher

rem ===================================================================
rem  CodeLite - double click this file to start the editor.
rem  Starts a small local server (localhost only) and opens the app
rem  in a dedicated app window using Edge or Chrome.
rem ===================================================================

set "SELF=%~dp0"
set "SERVER=%SELF%CodeLiteServer.ps1"
set "APPDIR=%SELF%app"
set "PORTFILE=%TEMP%\codelite.port"

if not exist "%SERVER%" (
  echo ERROR: CodeLiteServer.ps1 not found next to this file.
  echo Keep all CodeLite files together in the same folder.
  pause
  exit /b 1
)
if not exist "%APPDIR%\index.html" (
  echo ERROR: app\index.html not found. The CodeLite folder looks incomplete.
  pause
  exit /b 1
)

rem ---------- locate a browser ----------
set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"
set "LAP=%LocalAppData%"

set "BROWSER="
for %%P in (
  "%PF86%\Microsoft\Edge\Application\msedge.exe"
  "%PF%\Microsoft\Edge\Application\msedge.exe"
  "%LAP%\Microsoft\Edge\Application\msedge.exe"
  "%PF%\Google\Chrome\Application\chrome.exe"
  "%PF86%\Google\Chrome\Application\chrome.exe"
  "%LAP%\Google\Chrome\Application\chrome.exe"
  "%PF%\BraveSoftware\Brave-Browser\Application\brave.exe"
  "%LAP%\BraveSoftware\Brave-Browser\Application\brave.exe"
) do (
  if not defined BROWSER (
    if exist %%P set "BROWSER=%%~P"
  )
)

if not defined BROWSER (
  echo.
  echo  Could not find Microsoft Edge or Google Chrome.
  echo  CodeLite needs one of them to run.
  echo  Install Chrome from:  https://www.google.com/chrome/
  echo.
  pause
  exit /b 1
)

rem ---------- stop any previous instance ----------
del /q "%PORTFILE%" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$me=$PID; Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -like '*CodeLiteServer*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

rem ---------- start local server (hidden, own console window) ----------
start "CodeLite Server" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SERVER%" -Root "%APPDIR%"

rem ---------- wait for the port ----------
set "PORT="
for /l %%I in (1,1,40) do (
  if not defined PORT (
    if exist "%PORTFILE%" (
      set "CAND="
      set /p CAND=<"%PORTFILE%"
      echo !CAND!| findstr /r "^[0-9][0-9][0-9]*$" >nul && set "PORT=!CAND!"
    )
  )
  if not defined PORT ping -n 2 127.0.0.1 >nul
)

rem ---------- fallback: probe the usual port range ----------
if not defined PORT (
  for /l %%P in (8737,1,8767) do (
    if not defined PORT (
      powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try{ $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',%%P); $c.Close(); exit 0 }catch{ exit 1 }" >nul 2>&1
      if not errorlevel 1 set "PORT=%%P"
    )
  )
)

if not defined PORT (
  echo.
  echo  Could not start the local server.
  echo  If Windows blocked it, allow this file once and try again.
  echo.
  pause
  exit /b 1
)

rem ---------- launch app window ----------
set "PROFILE=%LOCALAPPDATA%\CodeLite\browser-profile"
if not exist "%PROFILE%" mkdir "%PROFILE%" >nul 2>&1

start "" "%BROWSER%" --app="http://localhost:%PORT%/" --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --disable-features=Translate,msSmartScreenProtection --window-size=1440,900

exit /b 0