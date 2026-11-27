@echo off
setlocal
cd /d "%~dp0"
title NOVEX Boerse
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js fehlt. Bitte zuerst von https://nodejs.org die LTS-Version installieren
  echo  und danach diese Datei erneut doppelklicken.
  echo.
  pause
  exit /b 1
)
echo.
echo  [1] Benoetigte Pakete installieren ...
call npm install --no-audit --no-fund
if errorlevel 1 goto fehler
echo.
echo  [2] Neue Version hochladen ...
call npx wrangler deploy
if errorlevel 1 goto anmelden
goto fertig
:anmelden
echo.
echo  Hochladen hat nicht geklappt - vermutlich ist die Cloudflare-Anmeldung abgelaufen.
echo  Es oeffnet sich gleich der Browser. Dort auf "Allow" klicken.
call npx wrangler login
if errorlevel 1 goto fehler
call npx wrangler deploy
if errorlevel 1 goto fehler
:fertig
echo.
echo  ============================================================
echo   Fertig! Die neue Version ist online. Spielstand, Konten und
echo   Einladungscode bleiben erhalten.
echo  ============================================================
echo.
pause
exit /b 0
:fehler
echo.
echo  Etwas hat nicht geklappt. Mach bitte einen Screenshot von diesem Fenster.
echo.
pause
exit /b 1
