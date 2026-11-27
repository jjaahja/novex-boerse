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
echo  [2] Bei Cloudflare anmelden - es oeffnet sich der Browser. Dort auf "Allow" klicken.
call npx wrangler login
if errorlevel 1 goto fehler
echo.
echo  [3] Einladungscode festlegen. Tippe den Code ein und druecke Enter.
echo      (Beim Tippen siehst du nichts, das ist normal.)
call npx wrangler secret put INVITE_CODE
if errorlevel 1 goto fehler
echo.
echo  [4] Boerse hochladen ...
call npx wrangler deploy
if errorlevel 1 goto fehler
echo.
echo  ============================================================
echo   Fertig! Die Adresse deiner Boerse steht oben (endet auf
echo   .workers.dev). Schick sie zusammen mit dem Einladungscode
echo   an deine Freunde.
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
